import type {Firestore, Transaction} from 'firebase-admin/firestore';
import {mapTeacherWork, projectionWorkId} from './student-source-mapper.ts';
import {parseStudentMembershipWindows} from './student-membership-windows.ts';
import {parseStudentProjectionWork, validStudentProjectionId, validStudentProjectionLabel} from './student-projection-document.ts';

export class StudentSyncForbidden extends Error {}

export async function readSyncScope(db:Firestore, tx:Transaction, actor:string, courseId:string, workId:string) {
  const base = db.collection('teachingAssignments').doc(courseId);
  const workRef = base.collection('work').doc(workId);
  const [config, profile, courseDoc, workDoc] = await tx.getAll(
    db.doc('portalConfig/student'), db.doc('profiles/'+actor), base, workRef,
  );
  const staff = profile.data();
  const course = courseDoc.data();
  const work = workDoc.data();
  if (config.data()?.enabled !== true || staff?.active !== true || course?.active !== true ||
      !validStudentProjectionId(course.termId) || !validStudentProjectionId(course.teacherUid) ||
      work?.active !== true || work.importPending === true ||
      !(staff.role === 'admin' || staff.role === 'super_admin' || (staff.role === 'teacher' && course.teacherUid === actor))) {
    throw new StudentSyncForbidden();
  }
  if (course.teacherUid !== actor && (await tx.get(db.doc('profiles/'+course.teacherUid))).data()?.active !== true) {
    throw new StudentSyncForbidden();
  }
  return {base, workRef, course, work, termId:course.termId};
}

export async function syncPublishedStudentWork(db:Firestore, actor:string, courseId:string, workId:string, studentId:string) {
  if (![actor, courseId, workId, studentId].every(validStudentProjectionId)) throw new StudentSyncForbidden();
  return db.runTransaction(async tx => {
    const {base, workRef, course, work, termId} = await readSyncScope(db, tx, actor, courseId, workId);
    const [rosterDoc, ownerDoc, student] = await tx.getAll(
      base.collection('roster').doc(studentId), db.doc('studentPortalOwners/'+studentId), db.doc('students/'+studentId),
    );
    const roster = rosterDoc.data();
    if (roster?.active !== true || roster.studentId !== studentId || student.data()?.active !== true) return;
    const owner = ownerDoc.data();
    if (!owner || owner.studentId !== studentId || !validStudentProjectionId(owner.uid)) return;

    const term = db.doc('studentPortalViews/'+owner.uid+'/terms/'+termId);
    const [publication, bindingDoc] = await tx.getAll(term, db.doc('studentPortalBindings/'+owner.uid));
    const binding = bindingDoc.data();
    if (!publication.exists || binding?.active !== true || binding.uid !== owner.uid || binding.studentId !== studentId) return;

    const [submission, mark, membership] = await tx.getAll(
      workRef.collection('submissions').doc(studentId), workRef.collection('attendance').doc(studentId),
      db.doc('studentPortalMemberships/'+studentId+'/terms/'+termId+'/courses/'+courseId),
    );
    const status = mark.data()?.status;
    if (mark.exists && (mark.data()?.studentId !== studentId || (status !== 'leave' && status !== 'absent' && status !== 'missing'))) {
      throw Error('Invalid attendance');
    }
    const membershipWindows = membership.exists ? parseStudentMembershipWindows(membership.data()?.windows).map(window => ({
      studentId, termId, courseId, ...window,
    })) : undefined;
    const row = mapTeacherWork({
      courseId, workId, studentId, termId, course, roster, work, submission:submission.data() ?? null,
      attendance:status, membershipWindows,
    });
    const projected = term.collection('works').doc(projectionWorkId(courseId,workId));
    if (row && !(await tx.get(projected)).exists) {
      const publishedWorks = await tx.get(term.collection('works').limit(449));
      if (publishedWorks.size >= 449) throw Error('Projection capacity exceeded');
    }
    if (!row) {
      tx.delete(projected);
      return;
    }
    const subject = validStudentProjectionId(course.subjectId) ? await tx.get(db.doc('subjects/'+course.subjectId)) : null;
    const label = subject?.data()?.name;
    tx.set(projected, parseStudentProjectionWork(row.id, {...row, subjectName:validStudentProjectionLabel(label) ? label : undefined}));
  });
}
