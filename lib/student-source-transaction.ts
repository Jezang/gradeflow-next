import {readTeacherSource,type TeacherSourceReader} from './student-source-reader.ts';
import type {MembershipWindow} from './student-historical-work';
type Row=Record<string,unknown>;
export interface SourceTransaction {
 getDocument(path:string):Promise<Row|null>;
 queryDocuments(path:string,filter:{field:string;value:string}|null,limit:number):Promise<readonly {id:string;data:Row}[]>;
}
export function transactionalTeacherReader(tx:SourceTransaction,history:(studentId:string,termId:string,courseId:string)=>Promise<readonly MembershipWindow[]|undefined>,attendance:TeacherSourceReader['attendance']):TeacherSourceReader{
 const list=async(path:string,filter:{field:string;value:string}|null)=>{
 const docs=await tx.queryDocuments(path,filter,501);
 return {docs,complete:docs.length<501};
 };
 return {get:path=>tx.getDocument(path),listTermCourses:term=>list('teachingAssignments',{field:'termId',value:term}),listWorks:course=>list('teachingAssignments/'+course+'/work',null),membershipWindows:history,attendance};
}
export async function readTransactionalTeacherSource(tx:SourceTransaction,history:TeacherSourceReader['membershipWindows'],attendance:TeacherSourceReader['attendance'],studentId:string,termId:string){
 return readTeacherSource(transactionalTeacherReader(tx,history,attendance),studentId,termId);
}
