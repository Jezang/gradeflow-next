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
 return snapshot.docs.map(d=>parseStudentProjectionWork(d.id,d.data()));
}

export async function readStudentTerms():Promise<{id:string;label:string}[]>{
 if(process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true')throw Error('Portal unavailable');
 const auth=studentAuth(),user=auth.currentUser;
 if(!user||!validStudentProjectionId(user.uid))throw Error('Sign in required');
 const snapshot=await getDocsFromServer(collection(getFirestore(auth.app),'studentPortalViews',user.uid,'terms'));
 if(auth.currentUser!==user)throw Error('Session changed');
 return snapshot.docs.map(d=>{const label=d.data().label;if(!validStudentProjectionId(d.id)||!validStudentProjectionLabel(label))throw Error('Invalid term');return {id:d.id,label}}).sort((a,b)=>b.id.localeCompare(a.id,'en',{numeric:true}));
}
