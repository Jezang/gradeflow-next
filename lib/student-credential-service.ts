import {createHash, randomBytes} from 'node:crypto';
import {studentLoginAlias} from './student-login-identity.ts';

export type StudentCredentialInput = {action:'provision'|'recover'; studentId:string};

export interface StudentCredentialBackend {
  enabled():Promise<boolean>;
  authorizeAdmin(token:string):Promise<string|null>;
  withOperation<T>(studentId:string, run:()=>Promise<T>):Promise<T>;
  readStudentNumber(studentId:string):Promise<string>;
  readOwnerUid(studentId:string):Promise<string|null>;
  ensureDedicatedAccount(uid:string, alias:string):Promise<void>;
  requireDedicatedAccount(uid:string, alias:string):Promise<void>;
  installCredential(input:StudentCredentialInput,uid:string,alias:string,password:string,actorUid:string):Promise<void>;
  enableAccount(uid:string,recover:boolean):Promise<void>;
}

export async function issueStudentCredential(
  backend:StudentCredentialBackend,
  token:string,
  {action,studentId}:StudentCredentialInput,
):Promise<{uid:string;password:string}> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(studentId) || (action!=='provision'&&action!=='recover')) throw Error('Invalid request');
  if (!token || !(await backend.enabled())) throw Error('Account management unavailable');
  const actorUid=await backend.authorizeAdmin(token);
  if (!actorUid) throw Error('Forbidden');

  return backend.withOperation(studentId, async()=>{
    const alias=studentLoginAlias(await backend.readStudentNumber(studentId));
    const ownerUid=await backend.readOwnerUid(studentId);
    const generatedUid='student-'+createHash('sha256').update(studentId).digest('hex');
    const uid=action==='provision'?generatedUid:ownerUid;
    if (!uid || (action==='provision' && ownerUid)) throw Error('Account already provisioned or missing');
    const password=randomBytes(24).toString('base64url');

    if (action==='provision') await backend.ensureDedicatedAccount(uid,alias);
    else await backend.requireDedicatedAccount(uid,alias);
    await backend.installCredential({action,studentId},uid,alias,password,actorUid);
    await backend.enableAccount(uid,action==='recover');

    return {uid,password};
  });
}
