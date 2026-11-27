import {FieldValue, type DocumentSnapshot, type Firestore, type QueryDocumentSnapshot} from 'firebase-admin/firestore';
import {closeStudentMembership, openStudentMembership, validEnrollmentId, type StudentEnrollmentChange} from './student-enrollment-change.ts';
import {parseStudentMembershipWindows} from './student-membership-windows.ts';

const failure = (status: number, error: string) => ({status, body: {error}});

function readMembership(document: DocumentSnapshot) {
  const version = document.get('version') ?? 0;
  if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) {
    throw Error('Invalid stored membership version');
  }
  return {version, windows: document.exists ? parseStudentMembershipWindows(document.get('windows')) : null};
}

type Outcome = {
  operationId: string;
  sourceCourses: number;
  targetCourses: number;
  termsToPublish: string[];
};

export async function changeStudentEnrollment(db: Firestore, input: StudentEnrollmentChange, actorUid: string) {
  const {action, studentId, sourceRoomId, sourceTermId, targetRoomId, targetTermId, effectiveAt, operationId} = input;
  const enrollment = db.collection('studentPortalEnrollments').doc(studentId);
  const operation = enrollment.collection('operations').doc(operationId);
  const sourceEnrollment = enrollment.collection('terms').doc(sourceTermId);
  const targetEnrollment = enrollment.collection('terms').doc(targetTermId);
  const student = db.collection('students').doc(studentId);
  const sourceTerm = db.collection('terms').doc(sourceTermId);
  const targetTerm = db.collection('terms').doc(targetTermId);
  const sourceRoom = db.collection('rooms').doc(sourceRoomId);
  const targetRoom = db.collection('rooms').doc(targetRoomId);
  const owner = db.collection('studentPortalOwners').doc(studentId);
  const courseQuery = (termId: string) =>
    db.collection('teachingAssignments').where('termId', '==', termId).limit(501);
  const rosterRef = (course: QueryDocumentSnapshot) => course.ref.collection('roster').doc(studentId);
  const membershipRef = (course: QueryDocumentSnapshot) => db.doc(
    `studentPortalMemberships/${studentId}/terms/${course.get('termId')}/courses/${course.id}`,
  );

  return db.runTransaction(async tx => {
    const [config, prior] = await tx.getAll(db.doc('portalConfig/student'), operation);
    if (config.get('enabled') !== true) return failure(503, 'Unavailable');
    if (prior.exists) {
      const original = prior.get('input') as StudentEnrollmentChange;
      if (!original || prior.get('actorUid') !== actorUid ||
          Object.entries(input).some(([key, value]) => original[key as keyof StudentEnrollmentChange] !== value)) {
        return failure(409, 'Operation ID was already used');
      }
      const result = prior.get('result') as Outcome;
      return {status: 200, body: {...result, replayed: true}};
    }

    const [studentDoc, sourceTermDoc, targetTermDoc, sourceRoomDoc, targetRoomDoc,
      sourceEnrollmentDoc, targetEnrollmentDoc, ownerDoc] = await Promise.all(
      [student, sourceTerm, targetTerm, sourceRoom, targetRoom, sourceEnrollment, targetEnrollment, owner]
        .map(ref => tx.get(ref)),
    );
    const name = studentDoc.get('name');
    if (studentDoc.get('active') !== true || typeof name !== 'string' || !name.trim() || name.length > 160 ||
        !sourceTermDoc.exists || !sourceRoomDoc.exists ||
        targetTermDoc.get('active') !== true || targetRoomDoc.get('active') !== true) {
      return failure(404, 'Active student, source term or room, or active destination not found');
    }
    if (sourceEnrollmentDoc.exists && (sourceEnrollmentDoc.get('roomId') !== sourceRoomId ||
        sourceEnrollmentDoc.get('effectiveAt') >= effectiveAt)) {
      return failure(409, 'Source enrollment changed or the effective time is too early');
    }
    if (action === 'promote' && targetEnrollmentDoc.exists) {
      return failure(409, 'Student already has enrollment in the destination term');
    }

    if (ownerDoc.exists) {
      const uid = ownerDoc.get('uid');
      if (!validEnrollmentId(uid) || ownerDoc.get('studentId') !== studentId) throw Error('Invalid student owner');
      const view = await tx.get(db.doc(`studentPortalViews/${uid}/terms/${targetTermId}`));
      if (view.exists) return failure(409, 'Withdraw the destination term before changing enrollment');
    }

    const sourceTermCourses = await tx.get(courseQuery(sourceTermId));
    const targetTermCourses = action === 'promote' ? await tx.get(courseQuery(targetTermId)) : sourceTermCourses;
    if (sourceTermCourses.size > 500 || targetTermCourses.size > 500) {
      return failure(409, 'Too many assignments to verify enrollment');
    }
    const sourceCourses = sourceTermCourses.docs.filter(course => course.get('roomId') === sourceRoomId);
    const targetCourses = targetTermCourses.docs.filter(course =>
      course.get('roomId') === targetRoomId && course.get('active') === true);
    if (!sourceCourses.length || !targetCourses.length) return failure(404, 'Teaching assignments not found');
    if (sourceCourses.length + targetCourses.length > 150) {
      return failure(409, 'Too many assignments for one enrollment transaction');
    }

    const otherCourses = targetTermCourses.docs.filter(course =>
      (action === 'promote' || course.get('roomId') !== sourceRoomId) &&
      course.get('roomId') !== targetRoomId && course.get('active') === true);
    const otherRosters = otherCourses.length ? await tx.getAll(...otherCourses.map(rosterRef)) : [];
    if (otherRosters.some(roster => roster.get('active') === true)) {
      return failure(409, 'Student already has an active roster in another room in the destination term');
    }

    const courses = [...sourceCourses, ...targetCourses];
    const snapshots = await tx.getAll(...courses.flatMap(course => [rosterRef(course), membershipRef(course)]));
    const records = courses.map((course, index) => ({
      course,
      roster: snapshots[index * 2],
      membership: snapshots[index * 2 + 1],
    }));
    if (records.some(({roster}) => roster.exists && roster.get('studentId') !== studentId)) {
      throw Error('Invalid roster student identity');
    }
    const current = records.slice(0, sourceCourses.length).filter(({roster}) => roster.get('active') === true);
    const destination = records.slice(sourceCourses.length);
    if (!current.length) return failure(409, 'Source room has no active roster entry for the student');
    if (destination.some(({roster}) => roster.get('active') === true)) {
      return failure(409, 'Student already has an active roster entry in the destination');
    }

    const changes = [
      ...(action === 'transfer' ? current.map(record => ({...record, active: false})) : []),
      ...destination.map(record => ({...record, active: true})),
    ].map(record => {
      const before = readMembership(record.membership);
      const windows = record.active
        ? openStudentMembership(before.windows, effectiveAt)
        : closeStudentMembership(before.windows, effectiveAt);
      return {...record, before, windows};
    });
    if (changes.some(({windows}) => windows === null)) {
      return failure(409, 'Existing membership windows conflict with the effective time');
    }

    for (const {roster, membership, active, before, windows} of changes) {
      if (roster.exists) tx.update(roster.ref, {active});
      else tx.create(roster.ref, {studentId, name, active});
      const version = before.version + 1;
      tx.set(membership.ref, {windows, version});
      tx.create(membership.ref.collection('history').doc(), {
        actorUid, previous: before.windows, windows, version, operationId, at: FieldValue.serverTimestamp(),
      });
    }
    const result: Outcome = {
      operationId, sourceCourses: current.length, targetCourses: destination.length, termsToPublish: [targetTermId],
    };
    tx.set(targetEnrollment, {roomId: targetRoomId, effectiveAt, lastOperationId: operationId});
    tx.create(operation, {actorUid, input, result, at: FieldValue.serverTimestamp()});
    return {status: 200, body: {...result, replayed: false}};
  });
}
