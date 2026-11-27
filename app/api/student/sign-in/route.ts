import {studentAdminServices} from '../../../../lib/student-admin-sdk';
import {handleStudentSignIn} from '../../../../lib/student-sign-in';
import {studentSignInBackend} from '../../../../lib/student-sign-in-server';

export const runtime='nodejs';

async function readSignInBody(request:Request):Promise<unknown> {
  const stream=request.body?.getReader();
  if (!stream) throw Error('Missing body');
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let body='';
  let bytes=0;
  try {
    while (true) {
      const {done,value}=await stream.read();
      if (done) break;
      bytes+=value.byteLength;
      if (bytes>4096) throw Error('Request too large');
      body+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(body+decoder.decode());
  } finally {
    await stream.cancel().catch(()=>{});
  }
}

export async function POST(request:Request) {
  const send=(body:object,status:number)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if (process.env.STUDENT_PORTAL_SERVER_ENABLED!=='true' || process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED!=='true') {
    return send({error:'Unavailable'},503);
  }

  let body:unknown;
  try {body=await readSignInBody(request)} catch {return send({error:'Invalid request'},400)}
  try {
    const {auth,db}=studentAdminServices();
    const result=await handleStudentSignIn(studentSignInBackend(auth,db),body);
    return send(result.body,result.status);
  } catch {
    return send({error:'Unavailable'},503);
  }
}
