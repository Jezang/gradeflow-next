import type {AccountTransaction,TrustedAccountBackend} from './student-account-service';
import type {AccountBinding,AccountOwner,AccountPlan} from './student-account-plan';
import {authorizeStudentAdmin,type IdentityVerifier} from './student-admin-authorization.ts';
interface Snapshot {exists:boolean;data():unknown}
interface Transaction {get(ref:unknown):Promise<Snapshot>;set(ref:unknown,data:object):unknown}
export interface AccountStore {doc(path:string):unknown;runTransaction<T>(fn:(tx:Transaction)=>Promise<T>):Promise<T>}
export function accountFirestoreBackend(store:AccountStore,identity:IdentityVerifier,authExists:TrustedAccountBackend['authExists'],enabled:()=>Promise<boolean>):TrustedAccountBackend{
 return {enabled,authExists,authorizeAdmin:token=>authorizeStudentAdmin(identity,token),transaction:run=>store.runTransaction(async tx=>{
 const read=async(path:string)=>{const snap=await tx.get(store.doc(path));return snap.exists?snap.data():null};
 const adapter:AccountTransaction={
 readBinding:async uid=>await read('studentPortalBindings/'+uid) as AccountBinding|null,
 readOwner:async sid=>await read('studentPortalOwners/'+sid) as AccountOwner|null,
 studentExists:async sid=>(await tx.get(store.doc('students/'+sid))).exists,
 writePlan:(plan:AccountPlan,actorUid:string)=>{
 tx.set(store.doc('studentPortalBindings/'+plan.binding.uid),plan.binding);
 tx.set(store.doc('studentPortalOwners/'+plan.owner.studentId),plan.owner);
 tx.set(store.doc('studentPortalAccountAudit/'+plan.binding.uid),{actorUid,studentId:plan.owner.studentId,active:plan.binding.active,updatedAt:Date.now()});
 }};
 return run(adapter);
 })};
}
