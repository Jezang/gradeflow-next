import {mapTeacherWork} from './student-source-mapper.ts';
import type {MembershipWindow} from './student-historical-work';
import type {Attendance} from './work-tracking';
import type {SourceWork} from './student-projection-plan';
type Row=Record<string,unknown>;
type Doc={id:string;data:Row};
export interface TeacherSourceReader {
 get(path:string):Promise<Row|null>;
 listTermCourses(termId:string):Promise<{docs:readonly Doc[];complete:boolean}>;
 listWorks(courseId:string):Promise<{docs:readonly Doc[];complete:boolean}>;
 membershipWindows(studentId:string,termId:string,courseId:string):Promise<readonly MembershipWindow[]|undefined>;
 attendance(courseId:string,workId:string,studentId:string):Promise<Attendance|undefined>;
}
export async function readTeacherSource(reader:TeacherSourceReader,studentId:string,termId:string):Promise<{label:string;rows:SourceWork[];complete:true}>{
 const valid=(s:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(s);
 if(!valid(studentId)||!valid(termId))throw Error('Invalid identity');
 const term=await reader.get('terms/'+termId);
 if(!term||typeof term.name!=='string'||!term.name.trim())throw Error('Missing term name');
 const courses=await reader.listTermCourses(termId);
 if(courses.complete!==true||courses.docs.length>500)throw Error('Incomplete courses');
 const rows:SourceWork[]=[];
 for(const course of courses.docs){
 if(!valid(course.id)||course.data.termId!==termId)throw Error('Invalid course scope');
 const base='teachingAssignments/'+course.id;
 const roster=await reader.get(base+'/roster/'+studentId);
 const membershipWindows=await reader.membershipWindows(studentId,termId,course.id);
 if(membershipWindows===undefined&&roster?.active!==true)continue;
 if(membershipWindows!==undefined&&!membershipWindows.some(w=>w.studentId===studentId&&w.termId===termId&&w.courseId===course.id))continue;
 const works=await reader.listWorks(course.id);
 if(works.complete!==true||works.docs.length>500)throw Error('Incomplete work list');
 for(const work of works.docs){
 if(!valid(work.id))throw Error('Invalid work identity');
 if(work.data.active!==true)continue;
 const submission=await reader.get(base+'/work/'+work.id+'/submissions/'+studentId);
 const attendance=await reader.attendance(course.id,work.id,studentId);
 const row=mapTeacherWork({courseId:course.id,workId:work.id,studentId,termId,course:course.data,roster,work:work.data,submission,attendance,membershipWindows});
 if(row)rows.push(row);
 if(rows.length>449)throw Error('Projection capacity exceeded');
 }
 }
 return {label:term.name,rows,complete:true};
}
