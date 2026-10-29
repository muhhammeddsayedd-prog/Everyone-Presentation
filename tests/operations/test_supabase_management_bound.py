"""Offline-only credential/API seam tests. No native credential or HTTP call."""
import base64
import io
import json
import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import supabase_management_bound as transport

TOKEN = 'sbp_' + 'a' * 40
PARAMETER = '-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nU3ludGhldGljIHB1YmxpYyB0ZXN0IG9ubHk=\n-----END PGP PUBLIC KEY BLOCK-----\n'
QUERY = 'select length($1::text)>0 as synthetic_bound_value;'


class Response:
    def __init__(self, data=b'[{"synthetic_bound_value":true}]', status=201, url=transport.ENDPOINT, content_type='application/json'):
        self.stream = io.BytesIO(data)
        self.status = status
        self.url = url
        self.headers = Message()
        self.headers['Content-Type'] = content_type
    def __enter__(self): return self
    def __exit__(self, *_): return None
    def geturl(self): return self.url
    def read(self, amount): return self.stream.read(amount)


class BoundTransportTests(unittest.TestCase):
    def test_known_native_cli_encodings_are_strict_and_never_printed(self):
        for value in (TOKEN.encode(), TOKEN.encode('utf-16-le'), b'go-keyring-base64:' + base64.b64encode(TOKEN.encode())):
            self.assertEqual(transport.decode_cli_token(value), TOKEN)
        for invalid in (b'', b'x' * 513, b'sbp_bad', TOKEN.encode() + b'\n', b'go-keyring-base64:bad!'):
            with self.assertRaises(transport.ManagementBoundError) as error:
                transport.decode_cli_token(invalid)
            self.assertNotIn(TOKEN, str(error.exception))

    def test_credential_chain_only_uses_two_official_exact_accounts_and_unknown_never_falls_back(self):
        with patch.object(transport, '_validate_cli_context'), patch.object(transport, '_read_windows_credential', side_effect=[None, TOKEN]) as read:
            self.assertEqual(transport.read_cli_access_token(), TOKEN)
            self.assertEqual([call.args for call in read.call_args_list], [('supabase',), ('access-token',)])
        with patch.object(transport, '_validate_cli_context'), patch.object(transport, '_read_windows_credential', side_effect=transport.ManagementBoundError('CLI_CREDENTIAL_UNAVAILABLE')) as read:
            with self.assertRaises(transport.ManagementBoundError): transport.read_cli_access_token()
            self.assertEqual(read.call_count, 1)

    def test_fixed_https_request_has_separate_bound_parameter_and_no_credential_in_sql(self):
        with patch.object(transport, 'read_cli_access_token', return_value=TOKEN), patch.object(transport, '_open_request', return_value=Response()) as send:
            self.assertEqual(transport.post_bound_query(QUERY, [PARAMETER], read_only=True), [{'synthetic_bound_value': True}])
            self.assertEqual(send.call_count, 1)
            request = send.call_args.args[0]
            self.assertEqual(request.full_url, transport.ENDPOINT)
            self.assertEqual(request.method, 'POST')
            self.assertEqual(request.get_header('Authorization'), 'Bearer ' + TOKEN)
            body = json.loads(request.data)
            self.assertEqual(body, {'query': QUERY, 'parameters': [PARAMETER], 'read_only': True})
            self.assertNotIn(PARAMETER, body['query'])
            self.assertNotIn(TOKEN, request.full_url + body['query'])

    def test_malformed_or_interpolated_sql_parameter_never_reads_credentials_or_sends(self):
        with patch.object(transport, 'read_cli_access_token') as credential, patch.object(transport, '_open_request') as send:
            for query, parameter, readonly in [(QUERY, ["';select1"], True), (QUERY + PARAMETER, [PARAMETER], True), ('select1', [PARAMETER], True), (QUERY + '$2', [PARAMETER], True), (QUERY, [PARAMETER], 1), (QUERY, ['71'*32], True), (QUERY, [PARAMETER.replace('PUBLIC KEY','PRIVATE KEY')], True)]:
                with self.assertRaises(transport.ManagementBoundError): transport.post_bound_query(query, parameter, read_only=readonly)
            credential.assert_not_called()
            send.assert_not_called()

    def test_redirect_oversize_wrong_type_and_private_upstream_failure_fail_without_retry(self):
        for response in (Response(url='https://untrusted.invalid'), Response(b'[]', content_type='text/html'), Response(b' ' * (transport.MAX_RESPONSE + 1)), Response(b'{}')):
            with patch.object(transport, 'read_cli_access_token', return_value=TOKEN), patch.object(transport, '_open_request', return_value=response) as send:
                with self.assertRaises(transport.ManagementBoundError) as error: transport.post_bound_query(QUERY, [PARAMETER], read_only=True)
                self.assertNotIn(TOKEN, str(error.exception))
                self.assertEqual(send.call_count, 1)
        with patch.object(transport, 'read_cli_access_token', return_value=TOKEN), patch.object(transport, '_open_request', side_effect=RuntimeError(TOKEN + PARAMETER)) as send:
            with self.assertRaises(transport.ManagementBoundError) as error: transport.post_bound_query(QUERY, [PARAMETER], read_only=True)
            self.assertEqual(str(error.exception), 'MANAGEMENT_BOUND_UNCONFIRMED')
            self.assertEqual(send.call_count, 1)

    def test_metadata_empty_parameters_and_public_nonce_stay_typed(self):
        with patch.object(transport, 'read_cli_access_token', return_value=TOKEN), patch.object(transport, '_open_request', return_value=Response()) as send:
            transport.post_bound_query('select true as synthetic_bound_value', [], read_only=True)
            self.assertEqual(json.loads(send.call_args.args[0].data)['parameters'], [])
        with patch.object(transport, 'read_cli_access_token', return_value=TOKEN), patch.object(transport, '_open_request', return_value=Response()) as send:
            transport.post_bound_query(QUERY + ' /* public nonce $2 */', [PARAMETER, '1'*32], read_only=False)
            self.assertEqual(json.loads(send.call_args.args[0].data)['parameters'], [PARAMETER, '1'*32])


if __name__ == '__main__': unittest.main()
