import{Buffer}from'node:buffer';
/** Isolated OpenPGP6.3.1 IPC. Raw key material is returned only to the parent
 * private pipe, never diagnostics. Not imported by app/worker/provider code. */
import{createHmac,timingSafeEqual}from'node:crypto';import{pathToFileURL}from'node:url';import path from'node:path';import process from'node:process';import *as pgp from'openpgp';
const CONFIG={v6Keys:false,aeadProtect:false,allowUnauthenticatedMessages:false,allowUnauthenticatedStream:false,maxDecompressedMessageSize:1024};
export class BootstrapError extends Error{constructor(){super('PRIVATE_BOOTSTRAP_UNCONFIRMED');this.name='BootstrapError';}}
function require(value){if(!value)throw new BootstrapError();}
export async function createRecipient(){try{
 const pair=await pgp.generateKey({type:'rsa',rsaBits:4096,userIDs:[{name:'EPS support verifier bootstrap'}],format:'armored',config:CONFIG});const publicKey=await pgp.readKey({armoredKey:pair.publicKey});const encryption=await publicKey.getEncryptionKey();
 require(pair.publicKey.length<=16384&&pair.privateKey.length<=16384&&publicKey.keyPacket.version===4&&publicKey.subkeys.length===1);
 return{public_key:pair.publicKey,private_key:pair.privateKey,public_fingerprint:publicKey.getFingerprint(),recipient_id:encryption.getKeyID().toHex()};
}catch{throw new BootstrapError();}}
export async function decryptKey(value){try{
 require(value&&typeof value==='object'&&typeof value.private_key==='string'&&value.private_key.length<=16384&&typeof value.public_key==='string'&&value.public_key.length<=16384
  &&/^[a-f0-9]{40}$/u.test(value.public_fingerprint)&&/^[a-f0-9]{16}$/u.test(value.recipient_id)&&/^[a-f0-9]{32}$/u.test(value.nonce)&&/^[a-f0-9]{64}$/u.test(value.nonce_hmac)
  &&typeof value.ciphertext==='string'&&value.ciphertext.length<=16384&&/^[A-Za-z0-9+/]+={0,2}$/u.test(value.ciphertext));
 require(value.public_key.startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----')&&!value.public_key.includes('PRIVATE KEY BLOCK')&&value.private_key.startsWith('-----BEGIN PGP PRIVATE KEY BLOCK-----'));
 const privateKey=await pgp.readPrivateKey({armoredKey:value.private_key,config:CONFIG});const publicKey=await pgp.readKey({armoredKey:value.public_key,config:CONFIG});
 require(!publicKey.isPrivate()&&privateKey.getFingerprint()===value.public_fingerprint&&publicKey.getFingerprint()===value.public_fingerprint&&privateKey.keyPacket.version===4&&privateKey.subkeys.length===1);
 const bytes=Buffer.from(value.ciphertext,'base64');require(bytes.toString('base64')===value.ciphertext&&bytes.length<=8192);
 const message=await pgp.readMessage({binaryMessage:new Uint8Array(bytes),config:CONFIG});const recipients=message.getEncryptionKeyIDs();require(recipients.length===1&&recipients[0].toHex()===value.recipient_id);
 const result=await pgp.decrypt({message,decryptionKeys:privateKey,format:'binary',config:CONFIG});require(result.data instanceof Uint8Array&&result.data.length===32);
 const key=Buffer.from(result.data),actual=createHmac('sha256',key).update(value.nonce,'utf8').digest(),expected=Buffer.from(value.nonce_hmac,'hex');require(timingSafeEqual(actual,expected));return key;
}catch{throw new BootstrapError();}}
async function main(){require(process.argv.length===2);let chunks=[],size=0;for await(const value of process.stdin){size+=value.length;require(size<=65536);chunks.push(value);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));require(input&&typeof input==='object'&&!Array.isArray(input));
 require(process.versions.node.split('.')[0]==='24');
 if(input.action==='generate'&&Object.keys(input).length===1){process.stdout.write(JSON.stringify(await createRecipient()));return;}
 if(input.action==='decrypt'&&Object.keys(input).length===2){const key=await decryptKey(input.payload);process.stdout.write(JSON.stringify({key_hex:key.toString('hex')}));key.fill(0);return;}throw new BootstrapError();}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('PRIVATE_BOOTSTRAP_UNCONFIRMED\n');process.exitCode=1;});
