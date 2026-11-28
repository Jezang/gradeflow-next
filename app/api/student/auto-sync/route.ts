import {studentAdminServices, studentServerEnabled} from '../../../../lib/student-admin-sdk';
import {readSyncScope, StudentSyncForbidden, syncPublishedStudentWork} from '../../../../lib/student-auto-sync';
import {validStudentProjectionId} from '../../../../lib/student-projection-document';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request:Request) {
  if (!studentServerEnabled()) return new Response(null,{status:503});
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return new Response(null,{status:401});
  const input = await request.json().catch(() => null);
  if (!input || !validStudentProjectionId(input.courseId) || !validStudentProjectionId(input.workId) ||
      !(input.studentId === undefined || validStudentProjectionId(input.studentId))) return new Response(null,{status:400});

  try {
    const {db,auth} = studentAdminServices();
    const identity = await auth.verifyIdToken(token,true).catch(() => null);
    if (!identity || !validStudentProjectionId(identity.uid)) return new Response(null,{status:401});
    const {courseId,workId,studentId} = input;
    if (studentId) {
      await syncPublishedStudentWork(db,identity.uid,courseId,workId,studentId);
    } else {
      const roster = await db.runTransaction(async tx => {
        const {base} = await readSyncScope(db,tx,identity.uid,courseId,workId);
        const rows = await tx.get(base.collection('roster').where('active','==',true).limit(501));
        if (rows.size > 500) throw Error('Roster exceeds sync limit');
        return rows.docs.map(row => row.id);
      });
      for (let i=0;i<roster.length;i+=12) {
        const results = await Promise.allSettled(roster.slice(i,i+12).map(id => syncPublishedStudentWork(db,identity.uid,courseId,workId,id)));
        if (results.some(result => result.status === 'rejected')) return new Response(null,{status:503});
      }
    }
    return new Response(null,{status:204});
  } catch (error) {
    return new Response(null,{status:error instanceof StudentSyncForbidden ? 403 : 503});
  }
}
