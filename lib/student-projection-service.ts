import {planStudentProjection,type SourceWork} from './student-projection-plan.ts';
import type {StudentWork} from './student-foundation';
import type {AccountBinding,AccountOwner} from './student-account-plan';
export interface ProjectionTransaction {
 readOwner(studentId:string):Promise<AccountOwner|null>;
 readBinding(uid:string):Promise<AccountBinding|null>;
 readSource(studentId:string,termId:string):Promise<readonly SourceWork[]>;
 replaceWorks(uid:string,termId:string,works:readonly StudentWork[]):void;
}
export interface ProjectionBackend {
 enabled():Promise<boolean>;
 authorizePublisher(token:string):Promise<boolean>;
 transaction<T>(run:(tx:ProjectionTransaction)=>Promise<T>):Promise<T>;
}
/** Trusted adapter must atomically replace the projection, including removing stale works. */
export async function publishStudentProjection(backend:ProjectionBackend,token:string,studentId:string,termId:string):Promise<number>{
 if(!token||!(await backend.enabled())||!(await backend.authorizePublisher(token)))throw Error('Forbidden');
 const valid=(s:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(s);
 if(!valid(studentId)||!valid(termId))throw Error('Invalid identity');
 return backend.transaction(async tx=>{
 const owner=await tx.readOwner(studentId);
 if(!owner||owner.studentId!==studentId||!valid(owner.uid))throw Error('Missing owner');
 const binding=await tx.readBinding(owner.uid);
 if(!binding||!binding.active||binding.uid!==owner.uid||binding.studentId!==studentId)throw Error('Invalid binding');
 const rows=await tx.readSource(studentId,termId);
 const works=planStudentProjection(studentId,termId,rows);
 tx.replaceWorks(owner.uid,termId,works);
 return works.length;
 });
}
