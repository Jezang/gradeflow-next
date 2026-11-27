import type {StudentWork} from './student-foundation';
import {parseStudentProjectionWork,validStudentProjectionId} from './student-projection-document.ts';
export type SourceWork=StudentWork & {studentId:string;termId:string;active:boolean};
export function planStudentProjection(studentId:string,termId:string,rows:readonly SourceWork[]):StudentWork[]{
 if(!validStudentProjectionId(studentId)||!validStudentProjectionId(termId))throw Error('Invalid projection identity');
 const seen=new Set<string>();
 return rows.filter(w=>w.studentId===studentId&&w.termId===termId&&w.active===true).map(w=>{
 if(seen.has(w.id))throw Error('Duplicate work identity');
 seen.add(w.id);
 return parseStudentProjectionWork(w.id,w);
 });
}
