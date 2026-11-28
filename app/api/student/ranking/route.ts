import {studentAdminServices, studentServerEnabled} from '../../../../lib/student-admin-sdk';
import {validStudentProjectionId} from '../../../../lib/student-projection-document';
import {readPrivateStudentRank, StudentRankForbidden} from '../../../../lib/student-private-rank-server';

export const runtime = 'nodejs';

export async function POST(request:Request) {
  const json = (body:object,status:number) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if (!studentServerEnabled()) return json({error:'Unavailable'},503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({error:'Authentication required'},401);
  const input = await request.json().catch(() => null);
  if (!input || !validStudentProjectionId(input.termId) ||
      !(input.courseId === undefined || validStudentProjectionId(input.courseId))) return json({error:'Invalid request'},400);

  try {
    const {db,auth} = studentAdminServices();
    const identity = await auth.verifyIdToken(token,true).catch(() => null);
    if (!identity) return json({error:'Authentication required'},401);
    return json(await readPrivateStudentRank(db,identity,input.termId,input.courseId),200);
  } catch (error) {
    return error instanceof StudentRankForbidden ? json({error:'Forbidden'},403) : json({error:'Unavailable'},503);
  }
}
