import {issueStudentCredential,type StudentCredentialBackend} from './student-credential-service.ts';
import {manageStudentAccount,type TrustedAccountBackend} from './student-account-service.ts';
export async function handleStudentAccount(backend:TrustedAccountBackend,authorization:string|null,body:unknown,credentials?:StudentCredentialBackend):Promise<{status:number;body:{ok?:boolean;uid?:string;password?:string;error?:string}}>{
 const token=authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)return {status:401,body:{error:'Authentication required'}};
 if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,body:{error:'Invalid request'}};
 const input=body as Record<string,unknown>;
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
 if ('action' in input) {
  if (Object.keys(input).length!==2 || !valid(input.studentId) || (input.action!=='provision'&&input.action!=='recover')) return {status:400,body:{error:'Invalid request'}};
  if (!credentials) return {status:503,body:{error:'Account management unavailable'}};
  try {
   const result=await issueStudentCredential(credentials,token,{studentId:input.studentId,action:input.action});
   return {status:200,body:{ok:true,...result}};
  } catch {
   return {status:403,body:{error:'Account management unavailable'}};
  }
 }
 if(Object.keys(input).length!==3||!valid(input.uid)||!valid(input.studentId)||typeof input.active!=='boolean')return {status:400,body:{error:'Invalid request'}};
 try{await manageStudentAccount(backend,token,{uid:input.uid,studentId:input.studentId,active:input.active});return {status:200,body:{ok:true}}}
 catch{return {status:403,body:{error:'Account management unavailable'}}}
}
