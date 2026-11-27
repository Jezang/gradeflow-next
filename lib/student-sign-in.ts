import {studentLoginAlias} from './student-login-identity.ts';
import {studentAliasKey,verifyStudentPassword} from './student-password.ts';

export type StudentLoginVerifier = {uid:string;version:string;salt:string;hash:string};

export interface StudentSignInBackend {
  enabled():Promise<boolean>;
  takeAttempt(key:string):Promise<StudentLoginVerifier|null|'limited'>;
  resetAttempts(key:string,verifier:StudentLoginVerifier):Promise<void>;
  createToken(uid:string,version:string):Promise<string>;
}

export const studentSignInWindowMs=5*60_000;
export const studentSignInAttemptsPerAccount=12;
export const studentSignInAttemptsPerShard=120;
export const studentSignInShardCount=32;

export function studentSignInAttemptCount(value:unknown, bucket:number):number {
  if (!value || typeof value!=='object') return 0;
  const record=value as {bucket?:unknown;attempts?:unknown};
  return record.bucket===bucket && typeof record.attempts==='number' && Number.isSafeInteger(record.attempts) && record.attempts>=0
    ? record.attempts
    : 0;
}

export async function handleStudentSignIn(backend:StudentSignInBackend,body:unknown):Promise<{
  status:number;body:{token?:string;error?:string};
}> {
  if (!body || typeof body!=='object' || Array.isArray(body)) return {status:400,body:{error:'Invalid request'}};
  const input=body as Record<string,unknown>;
  if (Object.keys(input).length!==2 || typeof input.studentNumber!=='string' || typeof input.password!=='string' ||
      input.studentNumber.length>32 || input.password.length<10 || input.password.length>128) return {status:400,body:{error:'Invalid request'}};
  let alias:string;
  try {alias=studentLoginAlias(input.studentNumber)} catch {return {status:400,body:{error:'Invalid request'}}}
  if (!(await backend.enabled())) return {status:503,body:{error:'Unavailable'}};

  const key=studentAliasKey(alias);
  const verifier=await backend.takeAttempt(key);
  if (verifier==='limited') return {status:401,body:{error:'Sign-in failed'}};
  const match=await verifyStudentPassword(input.password,verifier??undefined);
  if (!match || !verifier) return {status:401,body:{error:'Sign-in failed'}};
  await backend.resetAttempts(key,verifier);
  return {status:200,body:{token:await backend.createToken(verifier.uid,verifier.version)}};
}
