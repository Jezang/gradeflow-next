import {authorizeStudentAdmin} from '../../../../lib/student-admin-authorization';
import {studentAdminServices, studentServerEnabled} from '../../../../lib/student-admin-sdk';
import {parseEnrollmentChange} from '../../../../lib/student-enrollment-change';
import {changeStudentEnrollment} from '../../../../lib/student-enrollment-server';

export const runtime = 'nodejs';

const json = (body: object, status = 200) =>
  Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

export async function POST(request: Request) {
  if (!studentServerEnabled()) return json({error: 'Unavailable'}, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({error: 'Authentication required'}, 401);

  try {
    const {auth, db} = studentAdminServices();
    const actorUid = await authorizeStudentAdmin(auth, token);
    if (!actorUid) return json({error: 'Forbidden'}, 403);
    const input = parseEnrollmentChange(await request.json().catch(() => null), Date.now());
    if (!input) return json({error: 'Invalid enrollment change'}, 400);
    const result = await changeStudentEnrollment(db, input, actorUid);
    return json(result.body, result.status);
  } catch {
    return json({error: 'Unavailable'}, 503);
  }
}
