import {FieldValue} from 'firebase-admin/firestore';
import {authorizeStudentAdmin} from '../../../../lib/student-admin-authorization';
import {studentAdminServices, studentServerEnabled} from '../../../../lib/student-admin-sdk';
import {parseStudentMembershipWindows, type StudentMembershipWindow} from '../../../../lib/student-membership-windows';

export const runtime = 'nodejs';

const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const json = (body: object, status = 200) =>
  Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

async function handle(request: Request, save: boolean) {
  if (!studentServerEnabled()) return json({error: 'Unavailable'}, 503);
  const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return json({error: 'Authentication required'}, 401);

  try {
    const {auth, db} = studentAdminServices();
    const actor = await authorizeStudentAdmin(auth, token);
    if (!actor) return json({error: 'Forbidden'}, 403);

    let input: Record<string, unknown>;
    try {
      const value = save ? await request.json() : Object.fromEntries(new URL(request.url).searchParams);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid request');
      input = value;
    } catch {
      return json({error: 'Invalid request'}, 400);
    }

    const {studentId, termId, courseId, expectedVersion} = input;
    if (!validId(studentId) || !validId(termId) || !validId(courseId)) {
      return json({error: 'Invalid membership identity'}, 400);
    }
    let windows: StudentMembershipWindow[] | undefined;
    if (save) {
      if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
        return json({error: 'Invalid membership version'}, 400);
      }
      try {
        windows = parseStudentMembershipWindows(input.windows);
      } catch {
        return json({error: 'Invalid membership windows'}, 400);
      }
    }

    const membership = db.doc(`studentPortalMemberships/${studentId}/terms/${termId}/courses/${courseId}`);
    const audit = membership.collection('history').doc();
    return await db.runTransaction(async transaction => {
      const [configuration, student, course, current] = await transaction.getAll(
        db.doc('portalConfig/student'), db.doc(`students/${studentId}`),
        db.doc(`teachingAssignments/${courseId}`), membership,
      );
      if (configuration.get('enabled') !== true) return json({error: 'Unavailable'}, 503);
      if (!student.exists || course.get('termId') !== termId) return json({error: 'Membership scope not found'}, 404);

      const version = current.get('version') ?? 0;
      if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) {
        throw Error('Invalid stored membership version');
      }
      const previous = current.exists ? parseStudentMembershipWindows(current.get('windows')) : null;
      if (!windows) return json({windows: previous, version});
      if (expectedVersion !== version) return json({error: 'Membership changed. Reload before saving.'}, 409);

      const owner = await transaction.get(db.doc(`studentPortalOwners/${studentId}`));
      if (owner.exists) {
        const uid = owner.get('uid');
        if (owner.get('studentId') !== studentId || !validId(uid)) throw Error('Invalid student owner');
        const published = await transaction.get(db.doc(`studentPortalViews/${uid}/terms/${termId}`));
        if (published.exists) return json({error: 'Withdraw the published term before editing membership.'}, 409);
      }

      const nextVersion = version + 1;
      transaction.set(membership, {windows, version: nextVersion});
      transaction.create(audit, {
        actorUid: actor, previous, windows, version: nextVersion, at: FieldValue.serverTimestamp(),
      });
      return json({windows, version: nextVersion});
    });
  } catch {
    return json({error: 'Unavailable'}, 503);
  }
}

export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
