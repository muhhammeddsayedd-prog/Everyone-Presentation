import{Buffer}from'node:buffer';
import assert from'node:assert/strict';import test from'node:test';import{createHmac,randomBytes,timingSafeEqual}from'node:crypto';import *as pgp from'openpgp';
import{createRecipient,decryptKey,BootstrapError}from'./bootstrap.mjs';
test('RSA-v4 recipient decrypts authenticated32-byte bootstrap with exact nonce HMAC',async()=>{
 const recipient=await createRecipient();const key=randomBytes(32),nonce='0123456789abcdef0123456789abcdef';const publicKey=await pgp.readKey({armoredKey:recipient.public_key});assert.equal(publicKey.getAlgorithmInfo().algorithm,'rsaEncryptSign');
 const message=await pgp.encrypt({message:await pgp.createMessage({binary:key}),encryptionKeys:publicKey,format:'binary',config:{aeadProtect:false,preferredCompressionAlgorithm:pgp.enums.compression.uncompressed}});
 const hmac=createHmac('sha256',key).update(nonce).digest('hex');const result=await decryptKey({...recipient,ciphertext:Buffer.from(message).toString('base64'),nonce,nonce_hmac:hmac});assert(timingSafeEqual(result,key));
 await assert.rejects(decryptKey({...recipient,ciphertext:Buffer.from(message).toString('base64'),nonce,nonce_hmac:'0'.repeat(64)}),BootstrapError);
 await assert.rejects(decryptKey({...recipient,ciphertext:'bad',nonce,nonce_hmac:hmac}),BootstrapError);
});
