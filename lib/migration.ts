type Obj=Record<string,unknown>;
function obj(x:unknown):Obj|null{return x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Obj:null}
export function inspectLegacy(raw:unknown){
 const root=obj(raw);if(!root)throw Error('ไฟล์ JSON ไม่ใช่ข้อมูลระบบเดิม');
 const students=obj(root.students),assignments=obj(root.assignments),records=obj(root.records);
 if(!students||!assignments||!records)throw Error('ไม่พบ students, assignments หรือ records');
 const issues:string[]=[],roster:{code:string;name:string;level:string;room:string;subject:string;no:string}[]=[];
 const groups=new Map<string,number>();let total=0,sent=0,graded=0,leave=0,absent=0,notes=0;
 const field=(x:unknown)=>typeof x==='string'||typeof x==='number'?String(x).trim():'';
 for(const [id,value] of Object.entries(students)){const s=obj(value);if(!s||field(s.id)!==id||!/^[A-Za-z0-9_-]{1,60}$/.test(id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>160){issues.push('นักเรียนรหัส '+id+' ต้องตรวจสอบ');continue}const row={code:id,name:s.name.trim(),level:field(s.level),room:field(s.room),subject:field(s.subject),no:field(s.no)};roster.push(row);const key=[row.level,row.room,row.subject].join(' · ');groups.set(key,(groups.get(key)||0)+1)}
 for(const [id,value] of Object.entries(assignments)){const a=obj(value);if(!a||field(a.id)!==id||typeof a.name!=='string'||!a.name.trim()||typeof a.maxScore!=='number'||!Number.isFinite(a.maxScore)||a.maxScore<=0||a.maxScore>1000)issues.push('งาน '+id+' ต้องตรวจสอบชื่อหรือคะแนนเต็ม');}
 for(const [aid,value] of Object.entries(records)){const a=obj(assignments[aid]),rs=obj(value);if(!a||!rs){issues.push('ไม่พบงานหรือข้อมูลรายการ '+aid);continue}for(const [sid,value] of Object.entries(rs)){total++;const s=obj(value);if(!s||!Object.hasOwn(students,sid)){issues.push('รายการ '+aid+' / '+sid+' ไม่พบข้อมูลนักเรียน');continue}if(s.submitted===true)sent++;if(s.status==='leave')leave++;if(s.status==='absent')absent++;if(typeof s.note==='string'&&s.note.trim())notes++;if(s.score!=null){if(typeof s.score!=='number'||!Number.isFinite(s.score)||s.score<0||typeof a.maxScore!=='number'||s.score>a.maxScore||s.submitted!==true)issues.push('คะแนน '+aid+' / '+sid+' ต้องตรวจสอบ');else graded++}if(typeof s.submitted!=='boolean'||(s.submitted===true&&(s.status==='leave'||s.status==='absent')))issues.push('สถานะ '+aid+' / '+sid+' ต้องตรวจสอบ')}}
 return {students:Object.keys(students).length,assignments:Object.keys(assignments).length,records:total,sent,graded,leave,absent,notes,groups:[...groups].map(([name,count])=>({name,count})),roster,issues};
}
