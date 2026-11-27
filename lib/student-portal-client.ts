import {portalAuth} from './firebase';
import {signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {collection,getDocsFromServer,getFirestore} from 'firebase/firestore';
import type {StudentWork} from './student-foundation';
const validId=(v:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(v);
export async function studentSignIn(email:string,password:string){
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true')throw Error('Portal disabled');
 return signInWithEmailAndPassword(portalAuth(),email.trim(),password);
}
export async function studentSignOut(){await signOut(portalAuth())}
export async function readStudentWorks(termId:string):Promise<StudentWork[]>{
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true'||!validId(termId))throw Error('Portal unavailable');
 const auth=portalAuth(),user=auth.currentUser;
 if(!user||!validId(user.uid))throw Error('Sign in required');
 const snapshot=await getDocsFromServer(collection(getFirestore(auth.app),'studentPortalViews',user.uid,'terms',termId,'works'));
 if(auth.currentUser!==user)throw Error('Session changed');
 return snapshot.docs.map(d=>{
  const w=d.data();
  const date=(v:unknown):number|null=>{if(v===null)return null;if(typeof v==='number'&&Number.isFinite(v))return v;throw Error('Invalid date')};
  if(typeof w.title!=='string'||typeof w.course!=='string'||typeof w.maxScore!=='number'||!Number.isFinite(w.maxScore)||w.maxScore<=0||typeof w.submitted!=='boolean'||(w.score!==null&&(typeof w.score!=='number'||!Number.isFinite(w.score)||w.score<0||w.score>w.maxScore||!w.submitted)))throw Error('Invalid projection');
  if(w.attendance!==undefined&&w.attendance!=='leave'&&w.attendance!=='absent')throw Error('Invalid attendance');
  return {id:d.id,title:w.title,course:w.course,maxScore:w.maxScore,score:w.score,submitted:w.submitted,attendance:w.attendance,deadline:date(w.deadline),revisionDeadline:date(w.revisionDeadline)};
 });
}

export async function readStudentTerms():Promise<{id:string;label:string}[]>{
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true')throw Error('Portal unavailable');
 const auth=portalAuth(),user=auth.currentUser;
 if(!user||!validId(user.uid))throw Error('Sign in required');
 const snapshot=await getDocsFromServer(collection(getFirestore(auth.app),'studentPortalViews',user.uid,'terms'));
 if(auth.currentUser!==user)throw Error('Session changed');
 return snapshot.docs.map(d=>{const label=d.data().label;if(!validId(d.id)||typeof label!=='string'||!label.trim())throw Error('Invalid term');return {id:d.id,label}}).sort((a,b)=>b.id.localeCompare(a.id,'en',{numeric:true}));
}
