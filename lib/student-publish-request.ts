import {publishStudentProjection,type ProjectionBackend} from './student-projection-service.ts';
export async function handleStudentPublish(backend:ProjectionBackend,authorization:string|null,body:unknown):Promise<{status:number;body:{published?:number;error?:string}}>{
 const match=authorization?.match(/^Bearer ([^\s]+)$/i);
 if(!match)return {status:401,body:{error:'Authentication required'}};
 if(!body||typeof body!=='object'||Array.isArray(body))return {status:400,body:{error:'Invalid request'}};
 const input=body as Record<string,unknown>;
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
 if(Object.keys(input).length!==2||!valid(input.studentId)||!valid(input.termId))return {status:400,body:{error:'Invalid request'}};
 try{return {status:200,body:{published:await publishStudentProjection(backend,match[1],input.studentId,input.termId)}}}
 catch{return {status:403,body:{error:'Publication unavailable'}}}
}
