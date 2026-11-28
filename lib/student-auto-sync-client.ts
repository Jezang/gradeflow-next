import {firebaseServices} from './firebase';

export async function syncStudentWork(actor:string,courseId:string,workId:string,studentId?:string) {
  if (process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED !== 'true') return true;
  try {
    const auth = firebaseServices().auth;
    const user = auth.currentUser;
    if (!user || user.uid !== actor) return false;
    const token = await user.getIdToken();
    if (auth.currentUser !== user) return false;
    const response = await fetch('/api/student/auto-sync',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({courseId,workId,studentId}),
      signal:AbortSignal.timeout(60_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
