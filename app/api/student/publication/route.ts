import {handleStudentPublish} from '../../../../lib/student-publish-request';
import {studentProjectionServer} from '../../../../lib/student-projection-server';

export const runtime='nodejs';

function json(body:object,status:number){
 return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 if(process.env.STUDENT_PORTAL_SERVER_ENABLED!=='true')return json({error:'Unavailable'},503);
 const authorization=request.headers.get('authorization');
 if(!authorization?.match(/^Bearer [^\s]+$/i))return json({error:'Authentication required'},401);
 let body:unknown;
 try{body=await request.json()}catch{return json({error:'Invalid request'},400)}
 try{
  const result=await handleStudentPublish(studentProjectionServer(),authorization,body);
  return json(result.body,result.status);
 }catch{return json({error:'Unavailable'},503)}
}
