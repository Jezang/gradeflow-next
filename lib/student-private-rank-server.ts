import type {Firestore} from 'firebase-admin/firestore';
import type {DecodedIdToken} from 'firebase-admin/auth';
import {parseStudentProjectionWork, validStudentProjectionId, validStudentProjectionLabel} from './student-projection-document.ts';
import {privateRankBand, projectedCourseId} from './student-private-rank.ts';

export class StudentRankForbidden extends Error {}

export async function readPrivateStudentRank(db:Firestore, identity:DecodedIdToken, termId:string, courseId?:string) {
  if (identity.firebase.sign_in_provider !== 'custom' || typeof identity.gradeflowStudentSession !== 'string' ||
      !validStudentProjectionId(identity.uid)) throw new StudentRankForbidden();

  return db.runTransaction(async tx => {
    const uid = identity.uid;
    const [config,bindingDoc,publication] = await tx.getAll(
      db.doc('portalConfig/student'), db.doc('studentPortalBindings/'+uid), db.doc('studentPortalViews/'+uid+'/terms/'+termId),
    );
    const binding = bindingDoc.data();
    const studentId = binding?.studentId;
    const minAuthTime = binding?.minAuthTime ?? 0;
    if (config.data()?.enabled !== true || !publication.exists || !binding ||
        binding.uid !== uid || binding.active !== true || !validStudentProjectionId(studentId) ||
        !binding.credentialVersion || binding.credentialVersion !== identity.gradeflowStudentSession ||
        !Number.isInteger(minAuthTime) || minAuthTime < 0 || identity.auth_time < minAuthTime) throw new StudentRankForbidden();

    const [owner,student] = await tx.getAll(db.doc('studentPortalOwners/'+studentId),db.doc('students/'+studentId));
    if (owner.get('uid') !== uid || owner.get('studentId') !== studentId || student.get('active') !== true) {
      throw new StudentRankForbidden();
    }

    const snapshot = await tx.get(publication.ref.collection('works').limit(450));
    if (snapshot.size >= 450) throw Error('Projection capacity exceeded');
    const works = snapshot.docs.map(doc => parseStudentProjectionWork(doc.id,doc.data()));
    if (!courseId) {
      const needed = [...new Set(works.filter(work => !work.subjectName).map(work => work.course).filter(validStudentProjectionId))];
      if (!needed.length) return {labels:{}};
      const subjects = await tx.getAll(...needed.map(id => db.doc('subjects/'+id)));
      return {labels:Object.fromEntries(subjects.flatMap(subject => {
        const name = subject.get('name');
        return validStudentProjectionLabel(name) ? [[subject.id,name]] : [];
      }))};
    }

    const own = works.filter(work => projectedCourseId(work.id) === courseId);
    if (!own.length || own.length > 30 || own.some(work => work.score === null)) return {band:null};
    const course = db.doc('teachingAssignments/'+courseId);
    const [assignment,roster] = await Promise.all([
      tx.get(course), tx.get(course.collection('roster').where('active','==',true).limit(61)),
    ]);
    if (assignment.get('termId') !== termId || !roster.docs.some(doc => doc.id === studentId) ||
        roster.size < 10 || roster.size > 60) return {band:null};

    const peers = roster.docs.filter(doc => doc.id !== studentId && validStudentProjectionId(doc.id) && doc.get('studentId') === doc.id);
    if (peers.length < 9) return {band:null};
    const owners = await tx.getAll(...peers.map(peer => db.doc('studentPortalOwners/'+peer.id)));
    const candidates = owners.flatMap(owner => {
      const peerUid = owner.get('uid');
      return owner.get('studentId') === owner.id && validStudentProjectionId(peerUid) ? [{peerUid,sid:owner.id}] : [];
    });
    const available = await Promise.all(candidates.map(async ({peerUid,sid}) => {
      const [term,peerBinding,peerStudent] = await tx.getAll(
        db.doc('studentPortalViews/'+peerUid+'/terms/'+termId),
        db.doc('studentPortalBindings/'+peerUid), db.doc('students/'+sid),
      );
      if (!term.exists || peerBinding.get('studentId') !== sid || peerBinding.get('uid') !== peerUid ||
          peerBinding.get('active') !== true || peerStudent.get('active') !== true) return null;
      const docs = await tx.getAll(...own.map(work => term.ref.collection('works').doc(work.id)));
      let total = 0;
      for (const [index,doc] of docs.entries()) {
        if (!doc.exists) return null;
        const work = parseStudentProjectionWork(doc.id,doc.data() ?? {});
        if (work.score === null || work.maxScore !== own[index].maxScore) return null;
        total += work.score;
      }
      return total;
    }));
    return {band:privateRankBand(own.reduce((sum,work) => sum+(work.score ?? 0),0),
      available.filter((score): score is number => score !== null))};
  },{readOnly:true});
}
