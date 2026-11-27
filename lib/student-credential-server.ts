import {randomBytes,randomUUID} from 'node:crypto';
import type {Auth,UserRecord} from 'firebase-admin/auth';
import type {Firestore} from 'firebase-admin/firestore';
import {authorizeStudentAdmin} from './student-admin-authorization';
import {planStudentAccount,type AccountBinding,type AccountOwner} from './student-account-plan';
import type {StudentCredentialBackend} from './student-credential-service';
import {hashStudentPassword,studentAliasKey} from './student-password';
import {studentLoginAlias} from './student-login-identity';

export async function requireStudentIdentity(auth:Auth, db:Firestore, uid:string, alias:string):Promise<UserRecord> {
  const [user,profile]=await Promise.all([auth.getUser(uid),db.doc('profiles/'+uid).get()]);
  const claims=user.customClaims;
  if (profile.exists || user.email!==alias || claims?.admin || claims?.studentPublisher || user.providerData.some(provider=>provider.providerId!=='password')) {
    throw Error('Dedicated student identity required');
  }
  return user;
}

export async function readStudentNumber(db:Firestore, studentId:string, requireActive=true):Promise<string> {
  const student=(await db.doc('students/'+studentId).get()).data();
  if (typeof student?.code!=='string' || (requireActive && student.active!==true)) throw Error('Active student identity required');
  return student.code;
}

export async function withStudentCredentialOperation<T>(db:Firestore, studentId:string, run:()=>Promise<T>):Promise<T> {
  const lock=db.doc('studentPortalCredentialOperations/'+studentId);
  const operationId=randomUUID();
  await db.runTransaction(async tx=>{
    const operation=(await tx.get(lock)).data();
    if (operation && operation.expiresAt>Date.now()) throw Error('Account operation in progress');
    tx.set(lock,{operationId,expiresAt:Date.now()+5*60_000});
  });
  try {
    return await run();
  } finally {
    // A failed cleanup leaves a bounded lease. Never mask a completed issuance
    // or release a lease now held by a different operation.
    await db.runTransaction(async tx=>{
      if ((await tx.get(lock)).data()?.operationId===operationId) tx.delete(lock);
    }).catch(()=>{});
  }
}

export function studentCredentialBackend(auth:Auth,db:Firestore):StudentCredentialBackend {
  const config=db.doc('portalConfig/student');
  const ownerRef=(sid:string)=>db.doc('studentPortalOwners/'+sid);
  const bindingRef=(uid:string)=>db.doc('studentPortalBindings/'+uid);
  return {
    enabled:async()=>(await config.get()).data()?.enabled===true,
    authorizeAdmin:token=>authorizeStudentAdmin(auth,token),
    withOperation:(sid,run)=>withStudentCredentialOperation(db,sid,run),
    readStudentNumber:sid=>readStudentNumber(db,sid),
    readOwnerUid:async sid=>{
      const owner=(await ownerRef(sid).get()).data();
      if (!owner) return null;
      if (owner.studentId!==sid || typeof owner.uid!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(owner.uid)) throw Error('Invalid account owner');
      return owner.uid;
    },
    ensureDedicatedAccount:async(uid,alias)=>{
      try {
        const user=await requireStudentIdentity(auth,db,uid,alias);
        if (!user.disabled) throw Error('Account already exists');
      } catch (error) {
        if ((error as {code?:string}).code!=='auth/user-not-found') throw error;
        await auth.createUser({uid,email:alias,disabled:true});
      }
    },
    requireDedicatedAccount:async(uid,alias)=>{await requireStudentIdentity(auth,db,uid,alias)},
    installCredential:async({action,studentId:sid},uid,alias,password,actor)=>{
      const verifier=await hashStudentPassword(password);
      const credentialVersion=randomBytes(16).toString('hex');
      const verifierRef=db.doc('studentPortalLoginVerifiers/'+studentAliasKey(alias));
      await db.runTransaction(async tx=>{
        const [configuration,student,binding,owner,previousCredential]=await Promise.all([
          tx.get(config),tx.get(db.doc('students/'+sid)),tx.get(bindingRef(uid)),tx.get(ownerRef(sid)),tx.get(verifierRef),
        ]);
        const source=student.data();
        const previous=previousCredential.data();
        if (configuration.data()?.enabled!==true || source?.active!==true || typeof source.code!=='string' ||
            studentLoginAlias(source.code)!==alias || (previous && (previous.uid!==uid || previous.studentId!==sid))) {
          throw Error('Account management unavailable');
        }

        const currentBinding=(binding.data() as AccountBinding|undefined)??null;
        const currentOwner=(owner.data() as AccountOwner|undefined)??null;
        if (action==='recover' && (!currentBinding?.active || !currentOwner)) throw Error('Active student binding required');
        if (action==='provision' && (currentBinding || currentOwner)) throw Error('Account already bound');

        const plan=planStudentAccount({uid,studentId:sid,active:true,studentExists:true,authExists:true,
          binding:currentBinding,owner:currentOwner});
        tx.set(bindingRef(uid),{...plan.binding,credentialVersion});
        tx.set(ownerRef(sid),plan.owner);
        tx.set(verifierRef,{...verifier,uid,studentId:sid});
        tx.set(db.doc('studentPortalAccountAudit/'+uid),{actorUid:actor,studentId:sid,active:true,action,updatedAt:Date.now()});
      });
    },
    enableAccount:async(uid,recover)=>{
      if (recover) await auth.revokeRefreshTokens(uid);
      await auth.updateUser(uid,{disabled:false});
    },
  };
}

export async function verifyLinkedStudentIdentity(auth:Auth,db:Firestore,uid:string,studentId:string,active:boolean):Promise<boolean> {
  try {
    const user=await requireStudentIdentity(auth,db,uid,studentLoginAlias(await readStudentNumber(db,studentId,active)));
    return !active || !user.disabled;
  } catch {
    return false;
  }
}
