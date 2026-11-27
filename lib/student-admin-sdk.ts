import {applicationDefault,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
export function studentAdminServices(){
 if(process.env.STUDENT_PORTAL_SERVER_ENABLED!=='true')throw Error('Student server disabled');
 const projectId=process.env.STUDENT_PORTAL_PROJECT_ID;
 if(!projectId||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId))throw Error('Missing or invalid student project');
 const name='gradeflow-student-server';
 const app=getApps().find(a=>a.name===name)??initializeApp({credential:applicationDefault(),projectId},name);
 if(app.options.projectId!==projectId)throw Error('Student project mismatch');
 return {auth:getAuth(app),db:getFirestore(app)};
}
