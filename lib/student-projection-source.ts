import {parseStudentMembershipWindows} from './student-membership-windows.ts';
import {readTransactionalTeacherSource,type SourceTransaction} from './student-source-transaction.ts';

export async function readStudentProjectionSource(tx:SourceTransaction,studentId:string,termId:string) {
 return readTransactionalTeacherSource(
  tx,
  async (sid,term,courseId)=>{
   const doc=await tx.getDocument('studentPortalMemberships/'+sid+'/terms/'+term+'/courses/'+courseId);
   return doc===null?undefined:parseStudentMembershipWindows(doc.windows).map(window=>({
    studentId:sid,termId:term,courseId,...window
   }));
  },
  async (courseId,workId,sid)=>{
   const path='teachingAssignments/'+courseId+'/work/'+workId+'/attendance/'+sid;
   const mark=await tx.getDocument(path);
   if(mark===null)return undefined;
   if(mark.studentId!==sid)throw Error('Attendance identity mismatch');
   if(mark.status==='leave'||mark.status==='absent'||mark.status==='missing')return mark.status;
   throw Error('Invalid attendance');
  },
  studentId,
  termId
 );
}
