import {publishStudentProjection,withdrawStudentProjection,type ProjectionBackend} from './student-projection-service.ts';

type PublishResult={status:number;body:{published?:number;withdrawn?:boolean;error?:string}};

export async function handleStudentPublish(backend:ProjectionBackend,authorization:string|null,body:unknown):Promise<PublishResult>{
 const match=authorization?.match(/^Bearer ([^\s]+)$/i);
 if(!match)return {status:401,body:{error:'Authentication required'}};
 if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,body:{error:'Invalid request'}};
 const input=body as Record<string,unknown>;
 const keys=Object.keys(input);
 const valid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 if(keys.some(key=>!['studentId','termId','action'].includes(key))
     ||!valid(input.studentId)||!valid(input.termId)
     ||(keys.includes('action')&&input.action!=='publish'&&input.action!=='withdraw')){
  return {status:400,body:{error:'Invalid request'}};
 }
 try{
  if(input.action==='withdraw'){
   await withdrawStudentProjection(backend,match[1],input.studentId,input.termId);
   return {status:200,body:{withdrawn:true}};
  }
  return {status:200,body:{published:await publishStudentProjection(backend,match[1],input.studentId,input.termId)}};
 }catch{return {status:403,body:{error:'Publication unavailable'}}}
}
