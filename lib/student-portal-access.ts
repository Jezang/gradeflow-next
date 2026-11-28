import {boundStudent,type StudentBinding,type StudentWork} from './student-foundation.ts';
export type PortalRecord = Readonly<{studentId:string;termId:string;work:StudentWork}>;
/** Pure contract for trusted server callers only; never an authorization substitute in a browser. */
export function ownPortalRecords(uid:string|null, bindings:readonly StudentBinding[], records:readonly PortalRecord[], termId:string):StudentWork[]{
 if(!uid||!termId||!/^[A-Za-z0-9_-]{1,128}$/.test(termId))return [];
 const sid=boundStudent(uid,bindings);
 if(!sid)return [];
 return records.filter(r=>r.studentId===sid&&r.termId===termId).map(({work:w})=>({id:w.id,course:w.course,...(w.subjectName?{subjectName:w.subjectName}:{}),title:w.title,maxScore:w.maxScore,score:w.score,submitted:w.submitted,attendance:w.attendance,deadline:w.deadline,revisionDeadline:w.revisionDeadline}));
}
