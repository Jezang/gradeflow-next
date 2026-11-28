import {studentAdminServices, studentServerEnabled} from '../../../../lib/student-admin-sdk';
import {authorizeStudentAdmin} from '../../../../lib/student-admin-authorization';

export const runtime = 'nodejs';

function json(body:object,status:number) {
  return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request) {
  if (!studentServerEnabled()) return json({error:'Unavailable'},503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({error:'Authentication required'},401);
  const body = await request.json().catch(() => null);
  if (typeof body?.code !== 'string' || !/^[0-9]{1,32}$/.test(body.code)) return json({error:'Invalid student code'},400);
  try {
    const {auth,db} = studentAdminServices();
    if (!await authorizeStudentAdmin(auth,token) || (await db.doc('portalConfig/student').get()).data()?.enabled !== true) {
      return json({error:'Forbidden'},403);
    }
    const matches = await db.collection('students').where('code','==',body.code).limit(2).get();
    if (matches.empty) return json({error:'Student not found'},404);
    if (matches.size !== 1) return json({error:'Ambiguous student code'},409);
    const match = matches.docs[0];
    return json({id:match.id, name:match.get('name'), active:match.get('active')===true},200);
  } catch {
    return json({error:'Unavailable'},503);
  }
}
