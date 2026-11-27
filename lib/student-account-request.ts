import {manageStudentAccount,type TrustedAccountBackend} from './student-account-service.ts';
export async function handleStudentAccount(backend:TrustedAccountBackend,authorization:string|null,body:unknown):Promise<{status:number;body:{ok?:boolean;error?:string}}>{
 const token=authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)return {status:401,body:{error:'Authentication required'}};
 if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,body:{error:'Invalid request'}};
 const input=body as Record<string,unknown>;
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
 if(Object.keys(input).length!==3||!valid(input.uid)||!valid(input.studentId)||typeof input.active!=='boolean')return {status:400,body:{error:'Invalid request'}};
 try{await manageStudentAccount(backend,token,{uid:input.uid,studentId:input.studentId,active:input.active});return {status:200,body:{ok:true}}}
 catch{return {status:403,body:{error:'Account management unavailable'}}}
}
