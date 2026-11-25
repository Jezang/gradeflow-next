import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function sessionKey(value=process.env.LINE_SESSION_KEY){if(!value||!/^[0-9a-fA-F]{64}$/.test(value))return null;return Buffer.from(value,'hex')}
export function sealLine(key:Buffer,uid:string,token:string,to:string,now=Date.now()){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(uid));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({token,to,expires:now+8*3600000}),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function openLine(key:Buffer,uid:string,value:string,now=Date.now()):{token:string;to:string}|null{
 try{if(value.length>3800)return null;const data=Buffer.from(value,'base64url');if(data.length<29)return null;const decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAAD(Buffer.from(uid));decipher.setAuthTag(data.subarray(12,28));const p=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));if(typeof p.expires!=='number'||p.expires<=now||!validCredentials(p.token,p.to))return null;return {token:p.token,to:p.to}}catch{return null}
}
export function validCredentials(token:unknown,to:unknown){return typeof token==='string'&&token.length>=20&&token.length<=4096&&/^[-A-Za-z0-9_+/=.]+$/.test(token)&&typeof to==='string'&&/^[UCR][0-9a-fA-F]{32}$/.test(to)}
