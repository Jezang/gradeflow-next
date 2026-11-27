import {handleStudentAccount} from '../../../../lib/student-account-request';
import {studentAccountServer} from '../../../../lib/student-account-server';
import {studentAdminServices} from '../../../../lib/student-admin-sdk';
import {studentCredentialBackend} from '../../../../lib/student-credential-server';
export const runtime='nodejs';
export async function POST(request:Request){
 if(process.env.STUDENT_PORTAL_SERVER_ENABLED!=='true')return Response.json({error:'Unavailable'},{status:503});
 const authorization=request.headers.get('authorization');
 if(!authorization)return Response.json({error:'Authentication required'},{status:401});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:'Invalid request'},{status:400})}
 try {
  const {auth,db}=studentAdminServices();
  const result=await handleStudentAccount(studentAccountServer(),authorization,body,studentCredentialBackend(auth,db));
  return Response.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});
 }
 catch{return Response.json({error:'Unavailable'},{status:503})}
}
