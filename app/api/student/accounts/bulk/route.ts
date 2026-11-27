import {studentAdminServices} from '../../../../../lib/student-admin-sdk';
import {parseStudentBatch, provisionStudentBatch} from '../../../../../lib/student-batch-provision';
import {studentCredentialBackend} from '../../../../../lib/student-credential-server';

export const runtime = 'nodejs';

const json = (body: object, status = 200) =>
  Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

export async function POST(request: Request) {
  if (process.env.STUDENT_PORTAL_SERVER_ENABLED !== 'true') return json({error: 'Unavailable'}, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return json({error: 'Authentication required'}, 401);
  try {
    const {auth, db} = studentAdminServices();
    const backend = studentCredentialBackend(auth, db);
    if (!await backend.authorizeAdmin(token)) return json({error: 'Forbidden'}, 403);
    if (!await backend.enabled()) return json({error: 'Unavailable'}, 503);
    const body = await request.json().catch(() => null);
    const studentIds = body && Object.keys(body).length === 1 ? parseStudentBatch(body.studentIds) : null;
    if (!studentIds) return json({error: 'Invalid student list'}, 400);
    try {
      return json({results: await provisionStudentBatch(backend, token, studentIds)});
    } catch {
      return json({error: 'Unable to validate student list'}, 409);
    }
  } catch {
    return json({error: 'Unavailable'}, 503);
  }
}
