import type {SourceWork} from './student-projection-plan';
import {historicalWorkEligible,type MembershipWindow} from './student-historical-work.ts';
type Row=Record<string,unknown>;
export function mapTeacherWork(input:{courseId:string;workId:string;studentId:string;termId:string;course:Row;roster:Row|null;work:Row;submission:Row|null;attendance?:'leave'|'absent';membershipWindows?:readonly MembershipWindow[]}):SourceWork|null{
 const {courseId,workId,studentId,termId,course,roster,work,submission}=input;
 if(course.termId!==termId||work.active!==true)return null;
 if(input.membershipWindows===undefined&&(!roster||roster.active!==true))return null;
 if((roster&&roster.studentId!==studentId)||(submission&&submission.studentId!==studentId))throw Error('Student identity mismatch');
 const valid=(v:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(v);
 if(!valid(courseId)||!valid(workId))throw Error('Invalid work identity');
 const id=courseId.length+'_'+courseId+'_'+workId;
 if(id.length>128)throw Error('Projection identity too long');
 const date=(v:unknown):number|null=>{if(v==null)return null;if(typeof v==='object'&&'toMillis' in v&&typeof v.toMillis==='function'){const n=v.toMillis();if(typeof n==='number'&&Number.isFinite(n))return n}throw Error('Invalid timestamp')};
 if(input.membershipWindows!==undefined){const assignedAt=date(work.createdAt);if(assignedAt===null)throw Error('Missing assignment time');if(!historicalWorkEligible(input.membershipWindows,{studentId,termId,courseId,assignedAt}))return null;}
 if(typeof course.subjectId!=='string'||typeof work.title!=='string'||typeof work.maxScore!=='number')throw Error('Invalid source work');
 if(submission&&typeof submission.submitted!=='boolean')throw Error('Invalid submission');
 const score=submission?submission.score:null;
 if(score!==null&&typeof score!=='number')throw Error('Invalid source score');
 return {id,studentId,termId,active:true,course:course.subjectId,title:work.title,maxScore:work.maxScore,submitted:submission?.submitted===true,score,...(submission?.submitted!==true&&input.attendance?{attendance:input.attendance}:{}),deadline:date(work.deadline),revisionDeadline:date(work.revisionDeadline)};
}
