import {planStudentAccount,type AccountBinding,type AccountOwner,type AccountPlan} from './student-account-plan.ts';
export interface AccountTransaction {
 readBinding(uid:string):Promise<AccountBinding|null>;
 readOwner(studentId:string):Promise<AccountOwner|null>;
 studentExists(studentId:string):Promise<boolean>;
 writePlan(plan:AccountPlan,actorUid:string):void;
}
export interface TrustedAccountBackend {
 enabled():Promise<boolean>;
 authorizeAdmin(token:string):Promise<string|null>;
 authExists(uid:string):Promise<boolean>;
 transaction<T>(run:(tx:AccountTransaction)=>Promise<T>):Promise<T>;
}
/** Server-only integration contract. Adapter must verify tokens and commit both mappings and audit atomically. */
export async function manageStudentAccount(backend:TrustedAccountBackend,token:string,input:{uid:string;studentId:string;active:boolean}):Promise<AccountPlan>{
 if(!token||!(await backend.enabled()))throw Error('Account management unavailable');
 const actor=await backend.authorizeAdmin(token);
 if(!actor)throw Error('Forbidden');
 const {uid,studentId,active}=input;
 if(typeof uid!=='string'||typeof studentId!=='string'||typeof active!=='boolean'||!(/^[A-Za-z0-9_-]{1,128}$/).test(uid)||!(/^[A-Za-z0-9_-]{1,128}$/).test(studentId))throw Error('Invalid request');
 const authExists=await backend.authExists(uid);
 return backend.transaction(async tx=>{
 const [binding,owner,studentExists]=await Promise.all([tx.readBinding(uid),tx.readOwner(studentId),tx.studentExists(studentId)]);
 const plan=planStudentAccount({uid,studentId,active,binding,owner,studentExists,authExists});
 tx.writePlan(plan,actor);
 return plan;
 });
}
