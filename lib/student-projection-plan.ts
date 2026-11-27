import type {StudentWork} from './student-foundation';
export type SourceWork=StudentWork & {studentId:string;termId:string;active:boolean};
export function planStudentProjection(studentId:string,termId:string,rows:readonly SourceWork[]):StudentWork[]{
 if(!studentId||!termId)throw Error('Missing identity');
 const seen=new Set<string>();
 return rows.filter(w=>w.studentId===studentId&&w.termId===termId&&w.active).map(w=>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(w.id)||seen.has(w.id))throw Error('Invalid or duplicate work identity');
 seen.add(w.id);
 if(!Number.isFinite(w.maxScore)||w.maxScore<=0||(w.score!==null&&(!Number.isFinite(w.score)||w.score<0||w.score>w.maxScore||!w.submitted)))throw Error('Invalid score');
 return {id:w.id,course:w.course,title:w.title,maxScore:w.maxScore,score:w.score,submitted:w.submitted,deadline:w.deadline,revisionDeadline:w.revisionDeadline,...(w.attendance?{attendance:w.attendance}:{})};
 });
}
