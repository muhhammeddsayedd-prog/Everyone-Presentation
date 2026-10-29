import {DomainError} from '@eps/domain';
import {readCentralConfig,signSupportReceipt,type CentralStudioOptions} from '@eps/central';
import {verifyCandidateSupportOriginal} from './candidate-support-original';
function unavailable():never{throw new DomainError('SUPPORT_STORAGE_CONFIGURATION_REQUIRED','Private supporting-file verification is not configured.',503);}
export function readCentralSupportOptions(env:Readonly<Record<string,string|undefined>>=process.env):CentralStudioOptions['support']{
  if(typeof window!=='undefined')unavailable();
  if(!env.CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED||env.CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED==='false')return undefined;
  const id=env.EPS_SUPPORT_VERIFIER_KEY_ID,hex=env.EPS_SUPPORT_VERIFIER_KEY_HEX,maximum=env.CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES;
  if(env.CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED!=='true'||!id||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(id)||!hex||!/^[a-f0-9]{64}$/u.test(hex)
    ||!maximum||!/^[1-9][0-9]*$/u.test(maximum)||!Number.isSafeInteger(Number(maximum))||Number(maximum)>268435456)unavailable();
  const key=Buffer.from(hex,'hex');
  const otherKeys=[env.LOGO_VERIFICATION_KEY_BASE64URL,env.SPECS_VERIFICATION_KEY_BASE64URL].filter((value):value is string=>!!value).map(value=>Buffer.from(value,'base64url').toString('hex'));
  if(id===env.LOGO_VERIFICATION_KEY_ID||id===env.SPECS_VERIFICATION_KEY_ID||hex===env.EPS_JOB_CLAIM_KEY_HEX||otherKeys.includes(hex))unavailable();
  return {storageOrigin:readCentralConfig(env).url,maximumBytes:Math.min(Number(maximum),20*1024*1024),verifyDocument:verifyCandidateSupportOriginal,
    signReceipt(facts){const now=Math.floor(Date.now()/1000);return signSupportReceipt({...facts,schema_version:'candidate-support-verification.v1',
      audience:'eps.candidate-support-verification',purpose:'candidate_support',key_id:id,issued_at:now,expires_at:now+90},key);}};
}
