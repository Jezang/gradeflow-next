export type BackupRow={path:string;data:Record<string,unknown>};
export const MAX_ROWS=5000;
export const MAX_BYTES=10*1024*1024;
export const ROOTS=['students','rooms','subjects','terms','teachingAssignments','profiles','teacherRequests'] as const;
export function allowedPath(path:string){
 const p=path.split('/');if(p.some(s=>!s||s==='.'||s==='..'||s.length>1500))return false;
 if(p.length===2)return ROOTS.some(s=>s===p[0]);
 if(p[0]==='teachingAssignments')return (p.length===4&&['roster','work'].includes(p[2]))||(p.length===6&&p[2]==='work'&&p[4]==='submissions')||(p.length===8&&p[2]==='work'&&p[4]==='submissions'&&p[6]==='history');
 if(p[0]==='legacyArchives')return (p.length===4&&p[2]==='assignments')||(p.length===6&&p[2]==='assignments'&&p[4]==='students');
 return false;
}
export function inspectBackup(raw:unknown){
 if(!raw||typeof raw!=='object')throw Error('ไฟล์ไม่ถูกต้อง');
 const b=raw as Record<string,unknown>;
 if(b.format!=='gradeflow-firestore-v1'||b.project!=='gradeflow-next'||!Array.isArray(b.rows)||b.rows.length>MAX_ROWS)throw Error('รูปแบบหรือขนาดไฟล์ไม่รองรับ');
 const rows=new Map<string,Record<string,unknown>>(),issues:string[]=[];
 for(const item of b.rows){if(!item||typeof item.path!=='string'||!allowedPath(item.path)||!item.data||typeof item.data!=='object'||Array.isArray(item.data))throw Error('พบ path หรือข้อมูลที่ไม่รองรับ');if(rows.has(item.path))throw Error('พบ path ซ้ำ');rows.set(item.path,item.data)}
 const counts:Record<string,number>={};
 for(const [path,data] of rows){const p=path.split('/');const kind=p[p.length-2];counts[kind]=(counts[kind]||0)+1;
  if(p.length>2&&!(p[0]==='legacyArchives'&&p.length===4)&&!rows.has(p.slice(0,-2).join('/')))issues.push('ไม่พบข้อมูลหลัก: '+path);
  if(p[0]==='legacyArchives'&&!rows.has('teachingAssignments/'+p[1]))issues.push('ไม่พบรายวิชาของสำเนา: '+path);
  if(p[0]==='teachingAssignments'&&p.length===2){for(const [field,root] of [['teacherUid','profiles'],['roomId','rooms'],['subjectId','subjects'],['termId','terms']])if(typeof data[field]!=='string'||!rows.has(root+'/'+data[field]))issues.push('รายวิชาอ้างอิงข้อมูลที่ไม่มี: '+path+' '+field)}
  if(p[0]==='teachingAssignments'&&kind==='roster'&&!rows.has('students/'+p[3]))issues.push('ไม่พบข้อมูลนักเรียน: '+path);
  if(p[0]==='teachingAssignments'&&kind==='submissions'){const work=rows.get(p.slice(0,4).join('/'));if(!rows.has(p.slice(0,2).join('/')+'/roster/'+p[5]))issues.push('ไม่พบรายชื่อในรายวิชา: '+path);if(data.studentId!==p[5]||typeof data.submitted!=='boolean'||(data.submitted===false&&data.score!==null)||(data.score!==null&&(typeof data.score!=='number'||!Number.isFinite(data.score)||data.score<0||typeof work?.maxScore!=='number'||data.score>work.maxScore)))issues.push('คะแนนหรือสถานะไม่ถูกต้อง: '+path)}
 }
 return {total:rows.size,counts,issues};
}
