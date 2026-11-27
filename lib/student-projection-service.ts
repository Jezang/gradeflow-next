import {planStudentProjection,type SourceWork} from './student-projection-plan.ts';
import type {StudentWork} from './student-foundation';
import type {AccountBinding,AccountOwner} from './student-account-plan';

export interface ProjectionTransaction {
 readOwner(studentId:string):Promise<AccountOwner|null>;
 readBinding(uid:string):Promise<AccountBinding|null>;
 readSource(studentId:string,termId:string):Promise<readonly SourceWork[]>;
 replaceWorks(uid:string,termId:string,works:readonly StudentWork[]):void;
 removeTerm(uid:string,termId:string):Promise<void>;
}
export interface ProjectionBackend {
 enabled():Promise<boolean>;
 authorizePublisher(token:string):Promise<boolean>;
 transaction<T>(run:(tx:ProjectionTransaction)=>Promise<T>):Promise<T>;
}

const validId = (id:string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);

async function authorize(backend:ProjectionBackend,token:string,studentId:string,termId:string) {
 if(!validId(studentId)||!validId(termId))throw Error('Invalid identity');
 if(!token||!(await backend.authorizePublisher(token))||!(await backend.enabled()))throw Error('Forbidden');
}

async function projectionOwner(tx:ProjectionTransaction,studentId:string) {
 const owner=await tx.readOwner(studentId);
 if(!owner||owner.studentId!==studentId||!validId(owner.uid))throw Error('Missing owner');
 const binding=await tx.readBinding(owner.uid);
 if(!binding||binding.uid!==owner.uid||binding.studentId!==studentId)throw Error('Invalid binding');
 return binding;
}

/** Replace the projection atomically, including removal of stale works. */
export async function publishStudentProjection(backend:ProjectionBackend,token:string,studentId:string,termId:string):Promise<number>{
 await authorize(backend,token,studentId,termId);
 return backend.transaction(async tx=>{
  const owner=await projectionOwner(tx,studentId);
  if(owner.active!==true)throw Error('Inactive binding');
  const rows=await tx.readSource(studentId,termId);
  const works=planStudentProjection(studentId,termId,rows);
  tx.replaceWorks(owner.uid,termId,works);
  return works.length;
 });
}

export async function withdrawStudentProjection(backend:ProjectionBackend,token:string,studentId:string,termId:string):Promise<void>{
 await authorize(backend,token,studentId,termId);
 await backend.transaction(async tx=>{
  const owner=await projectionOwner(tx,studentId);
  await tx.removeTerm(owner.uid,termId);
 });
}
