import {studentAuth} from './firebase';
import {signInWithCustomToken,signOut} from 'firebase/auth';
import {collection,getDocsFromServer,getFirestore} from 'firebase/firestore';
import type {StudentWork} from './student-foundation';
import {parseStudentProjectionWork,validStudentProjectionId,validStudentProjectionLabel} from './student-projection-document';
export async function studentSignIn(studentNumber:string,password:string){
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true')throw Error('Portal disabled');
 const response=await fetch('/api/student/sign-in',{
  method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({studentNumber:studentNumber.trim(),password}),
 });
 if(!response.ok)throw Error('Sign-in failed');
 const result=await response.json();
 if(typeof result.token!=='string'||!result.token)throw Error('Sign-in failed');
 return signInWithCustomToken(studentAuth(),result.token);
}
export async function studentSignOut(){await signOut(studentAuth())}
export async function readStudentWorks(termId:string):Promise<StudentWork[]>{
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true'||!validStudentProjectionId(termId))throw Error('Portal unavailable');
 const auth=studentAuth(),user=auth.currentUser;
 if(!user||!validStudentProjectionId(user.uid))throw Error('Sign in required');
 const snapshot=await getDocsFromServer(collection(getFirestore(auth.app),'studentPortalViews',user.uid,'terms',termId,'works'));
 if(auth.currentUser!==user)throw Error('Session changed');
 const works=snapshot.docs.map(d=>parseStudentProjectionWork(d.id,d.data()));
 if(works.every(work=>work.subjectName))return works;
 const metadata=await requestPrivateStudentRank(termId).catch(()=>null);
 if(auth.currentUser!==user)throw Error('Session changed');
 const labels=metadata?.labels;
 return works.map(work=>{
  const label=labels&&Object.hasOwn(labels,work.course)?labels[work.course]:undefined;
  return !work.subjectName&&validStudentProjectionLabel(label)?{...work,subjectName:label}:work;
 });
}

export async function readStudentTerms():Promise<{id:string;label:string}[]>{
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true')throw Error('Portal unavailable');
 const auth=studentAuth(),user=auth.currentUser;
 if(!user||!validStudentProjectionId(user.uid))throw Error('Sign in required');
 const snapshot=await getDocsFromServer(collection(getFirestore(auth.app),'studentPortalViews',user.uid,'terms'));
 if(auth.currentUser!==user)throw Error('Session changed');
 return snapshot.docs.map(d=>{const label=d.data().label;if(!validStudentProjectionId(d.id)||!validStudentProjectionLabel(label))throw Error('Invalid term');return {id:d.id,label}}).sort((a,b)=>b.id.localeCompare(a.id,'en',{numeric:true}));
}

async function requestPrivateStudentRank(termId:string,courseId?:string) {
 const auth=studentAuth(),user=auth.currentUser;
 if(!user)throw Error('Sign in required');
 const token=await user.getIdToken();
 if(auth.currentUser!==user)throw Error('Session changed');
 const response=await fetch('/api/student/ranking',{
  method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({termId,courseId}),signal:AbortSignal.timeout(15_000),
 });
 if(!response.ok||auth.currentUser!==user)throw Error('Student ranking unavailable');
 const data=await response.json();
 if(auth.currentUser!==user)throw Error('Session changed');
 return data;
}

export async function readStudentRank(termId:string,courseId:string) {
 const band:unknown=(await requestPrivateStudentRank(termId,courseId)).band;
 if(band==='top-quarter'||band==='top-half'||band==='lower-half'||band===null)return band;
 throw Error('Invalid student ranking');
}
