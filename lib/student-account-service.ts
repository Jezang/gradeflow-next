import {randomBytes} from 'node:crypto';
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
  authExists(uid:string,studentId:string,active:boolean):Promise<boolean>;
  withOperation?<T>(studentId:string,run:()=>Promise<T>):Promise<T>;
  transaction<T>(run:(tx:AccountTransaction)=>Promise<T>):Promise<T>;
}

/** Server-only integration contract. The adapter commits both mappings and the audit together. */
export async function manageStudentAccount(
  backend:TrustedAccountBackend,
  token:string,
  {uid,studentId,active}:{uid:string;studentId:string;active:boolean},
):Promise<AccountPlan> {
  if (!token || !(await backend.enabled())) throw Error('Account management unavailable');
  const actor=await backend.authorizeAdmin(token);
  if (!actor) throw Error('Forbidden');
  const validId=(id:string)=>typeof id==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
  if (!validId(uid) || !validId(studentId) || typeof active!=='boolean') throw Error('Invalid request');

  const run=async()=>{
    const authExists=await backend.authExists(uid,studentId,active);
    return backend.transaction(async tx=>{
      const [binding,owner,studentExists]=await Promise.all([tx.readBinding(uid),tx.readOwner(studentId),tx.studentExists(studentId)]);
      const changingState=binding!==null && binding.active!==active;
      const plan=planStudentAccount({uid,studentId,active,binding,owner,studentExists,authExists});
      const updated=changingState && plan.binding.credentialVersion
        ? {...plan,binding:{...plan.binding,credentialVersion:randomBytes(16).toString('hex')}}
        : plan;
      tx.writePlan(updated,actor);
      return updated;
    });
  };
  return backend.withOperation?backend.withOperation(studentId,run):run();
}
