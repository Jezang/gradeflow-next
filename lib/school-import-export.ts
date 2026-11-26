export const IMPORT_LIMIT = 200;
export type SchoolKind = 'students'|'rooms'|'subjects'|'terms';
export type SchoolRecord = {code:string;name:string;active:boolean};
export type ImportRow = {code:string;name:string;active?:boolean};
export type PreviewRow = ImportRow & {before?:SchoolRecord;action:'new'|'rename'|'same'|'blocked'};
export const schoolLabels: Record<SchoolKind,string> = {students:'นักเรียน',rooms:'ห้องเรียน',subjects:'รายวิชา',terms:'ภาคเรียน'};
const examples:Record<SchoolKind,string[]>={students:['TEST001','นักเรียนตัวอย่าง'],rooms:['M2_1','ม.2/1'],subjects:['SUB001','รายวิชาตัวอย่าง'],terms:['2569_2','ภาคเรียนที่ 2/2569']};
export function template(kind:SchoolKind){return [['code','name'],examples[kind]];}
const blank=(v:unknown)=>v==null||v==='';
export function validateSchoolRows(rows:unknown[][]){
 const [header,...body]=rows;
 if(!header || ![2,3].includes(header.length) || header[0]!=='code'||header[1]!=='name'||(header.length===3&&header[2]!=='active')) throw Error('หัวตารางต้องเป็น code,name หรือ code,name,active ตามไฟล์ตัวอย่าง');
 if(body.length>IMPORT_LIMIT) throw Error('นำเข้าได้ไม่เกิน '+IMPORT_LIMIT+' แถวต่อไฟล์');
 const valid:ImportRow[]=[],errors:string[]=[],seen=new Set<string>();
 body.forEach((row,i)=>{
  if(row.every(blank))return;
  const code=typeof row[0]==='string'?row[0].trim():'',name=typeof row[1]==='string'?row[1].trim():'';
  const raw=row[2];const active=raw===true||raw==='true'?true:raw===false||raw==='false'?false:undefined;
  if(!/^[A-Za-z0-9_-]{1,60}$/.test(code)||!name||name.length>160||seen.has(code)||row.slice(header.length).some(v=>!blank(v))||(header.length===3&&active===undefined)){
   errors.push('แถว '+(i+2)+': ตรวจสอบรหัสซ้ำ รหัสแบบข้อความ ชื่อ และสถานะ');return;
  }
  seen.add(code);valid.push({code,name,active});
 });
 if(!valid.length)errors.push('ไม่พบรายการที่นำเข้าได้');
 return {valid,errors};
}
export function previewSchoolRows(rows:ImportRow[],existing:SchoolRecord[]):PreviewRow[]{
 const byCode=new Map(existing.map(r=>[r.code,r]));
 return rows.map(row=>{
  const before=byCode.get(row.code);
  const blocked=row.active!==undefined&&row.active!==(before?.active??true);
  return {...row,before,action:blocked?'blocked':!before?'new':before.name===row.name?'same':'rename'};
 });
}
export function sameRecord(a:SchoolRecord|undefined,b:SchoolRecord|undefined){
 return a===undefined?b===undefined:b!==undefined&&a.code===b.code&&a.name===b.name&&a.active===b.active;
}
export function exportSchoolRows(rows:SchoolRecord[]):unknown[][]{
 return [['code','name','active'],...([...rows].sort((a,b)=>a.code.localeCompare(b.code)).map(r=>[r.code,r.name,String(r.active)]))];
}
