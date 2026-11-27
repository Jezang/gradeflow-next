import {studentLoginAlias} from './student-login-identity.ts';
export type ProvisionStudent={studentId:string;studentNumber:string;active:boolean};
export function planStudentProvision(rows:readonly ProvisionStudent[]){
 const ids=new Set<string>(),aliases=new Set<string>();
 if(rows.length>500)throw Error('Batch too large');
 return rows.filter(r=>r.active===true).map(r=>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(r.studentId)||ids.has(r.studentId))throw Error('Invalid or duplicate student identity');
 const alias=studentLoginAlias(r.studentNumber);
 if(aliases.has(alias))throw Error('Duplicate login alias');
 ids.add(r.studentId);aliases.add(alias);
 return {studentId:r.studentId,alias,requiresActivation:true as const};
 });
}
