import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';

type StudentPassword = {salt:string;hash:string};
const placeholder:StudentPassword={salt:'00'.repeat(16),hash:'00'.repeat(32)};

export function studentAliasKey(alias:string):string {
  return createHash('sha256').update(alias).digest('hex');
}

function derive(password:string,salt:string):Promise<Buffer> {
  return new Promise((resolve,reject)=>{
    scrypt(password,Buffer.from(salt,'hex'),32,(error,key)=>error?reject(error):resolve(key));
  });
}

export async function hashStudentPassword(password:string):Promise<StudentPassword> {
  const salt=randomBytes(16).toString('hex');
  const hash=(await derive(password,salt)).toString('hex');
  return {salt,hash};
}

export async function verifyStudentPassword(password:string,stored?:StudentPassword):Promise<boolean> {
  const valid=stored && typeof stored.salt==='string' && typeof stored.hash==='string' &&
    /^[a-f0-9]{32}$/.test(stored.salt) && /^[a-f0-9]{64}$/.test(stored.hash);
  const verifier=valid?stored:placeholder;
  const derived=await derive(password,verifier.salt);
  return timingSafeEqual(derived,Buffer.from(verifier.hash,'hex')) && Boolean(valid);
}
