import {planEnrollment,type Enrollment} from './student-foundation.ts';
export type EnrollmentEvent=Readonly<{studentId:string;termId:string;before:Enrollment|null;after:Enrollment;actorUid:string;at:number}>;
export function planEnrollmentHistory(rows:readonly Enrollment[],next:Enrollment,actorUid:string,at:number){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(actorUid)||!Number.isSafeInteger(at)||at<0)throw Error('Invalid audit metadata');
 const updated=planEnrollment(rows,next);
 const previous=new Map(rows.map(r=>[JSON.stringify([r.studentId,r.termId]),r]));
 const events:EnrollmentEvent[]=[];
 for(const after of updated){
 const before=previous.get(JSON.stringify([after.studentId,after.termId]))??null;
 if(!before||before.roomId!==after.roomId||before.no!==after.no)events.push({studentId:after.studentId,termId:after.termId,before:before?{...before}:null,after:{...after},actorUid,at});
 }
 return {enrollments:updated,events};
}
