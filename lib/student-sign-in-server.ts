import type {Auth} from 'firebase-admin/auth';
import type {Firestore} from 'firebase-admin/firestore';
import {
  studentSignInAttemptCount,studentSignInAttemptsPerAccount,studentSignInAttemptsPerShard,
  studentSignInShardCount,studentSignInWindowMs,type StudentSignInBackend,
} from './student-sign-in.ts';

export function studentSignInBackend(auth:Auth,db:Firestore):StudentSignInBackend {
  const config=db.doc('portalConfig/student');
  return {
    enabled:async()=>(await config.get()).data()?.enabled===true,
    takeAttempt:async(key)=>{
      const verifierRef=db.doc('studentPortalLoginVerifiers/'+key);
      const shard=Number.parseInt(key.slice(0,2),16)%studentSignInShardCount;
      const shardRef=db.doc('studentPortalSignInLimits/'+shard);
      return db.runTransaction(async tx=>{
        const initial=await Promise.all([tx.get(config),tx.get(verifierRef),tx.get(shardRef)]);
        const [settings,credential,shardCount]=initial;
        if (settings.data()?.enabled!==true) return null;
        const bucket=Math.floor(Date.now()/studentSignInWindowMs);
        const shardAttempts=studentSignInAttemptCount(shardCount.data(),bucket);
        if (shardAttempts>=studentSignInAttemptsPerShard) return 'limited';

        const record=credential.data();
        const accountAttempts=studentSignInAttemptCount(record?.rate,bucket);
        if (accountAttempts>=studentSignInAttemptsPerAccount) return 'limited';

        const valid=record && typeof record.uid==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(record.uid) &&
          typeof record.studentId==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(record.studentId);
        const account=valid?await Promise.all([
          tx.get(db.doc('studentPortalBindings/'+record.uid)),tx.get(db.doc('studentPortalOwners/'+record.studentId)),
          tx.get(db.doc('students/'+record.studentId)),
        ]):null;
        const binding=account?.[0].data();
        const owner=account?.[1].data();
        tx.set(shardRef,{bucket,attempts:shardAttempts+1});
        if (!valid || account?.[2].data()?.active!==true || !binding || binding.uid!==record.uid ||
          binding.studentId!==record.studentId || binding.active!==true || !owner || owner.uid!==record.uid || owner.studentId!==record.studentId ||
          typeof binding.credentialVersion!=='string' || !/^[a-f0-9]{32}$/.test(binding.credentialVersion)) return null;
        tx.update(verifierRef,{rate:{bucket,attempts:accountAttempts+1}});
        return {uid:record.uid,version:binding.credentialVersion,salt:record.salt,hash:record.hash};
      });
    },
    resetAttempts:async(key,verifier)=>{
      const ref=db.doc('studentPortalLoginVerifiers/'+key);
      await db.runTransaction(async tx=>{
        const [credential,binding]=await Promise.all([tx.get(ref),tx.get(db.doc('studentPortalBindings/'+verifier.uid))]);
        const record=credential.data();
        if (record?.uid!==verifier.uid || record.hash!==verifier.hash || binding.data()?.credentialVersion!==verifier.version ||
          binding.data()?.active!==true) throw Error('Student credential changed');
        tx.update(ref,{rate:null});
      });
    },
    createToken:(uid,version)=>auth.createCustomToken(uid,{gradeflowStudentSession:version}),
  };
}
