// Pure preview only: no network calls, credentials, or writes.
export type WebGrade={studentId:string;name:string;submitted:boolean;score:number|null};
export type SheetGrade={row:number;name:string;value:unknown;formula:boolean};
export type ConfirmedMatch={studentId:string;row:number;name:string};
export type SyncDirection='import'|'export';
const normalize=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ');
export function planSheetGradeSync(input:{direction:SyncDirection;webMax:number;sheetMax:number;web:WebGrade[];sheet:SheetGrade[];matches:ConfirmedMatch[]}){
 if(!['import','export'].includes(input.direction))throw Error('ทิศทางไม่ถูกต้อง');
 if(!Number.isFinite(input.webMax)||input.webMax<=0||input.webMax!==input.sheetMax)throw Error('คะแนนเต็มต้องตรงกันในรุ่นแรก');
 const web=new Map(input.web.map(r=>[r.studentId,r]));
 const sheet=new Map(input.sheet.map(r=>[r.row,r]));
 if(web.size!==input.web.length||sheet.size!==input.sheet.length||
 new Set(input.matches.map(r=>r.studentId)).size!==input.matches.length||
 new Set(input.matches.map(r=>r.row)).size!==input.matches.length)throw Error('พบการจับคู่ซ้ำ');
 if(input.matches.length!==web.size||input.matches.length!==sheet.size)throw Error('ต้องตรวจยืนยันรายชื่อทั้งห้องให้ครบก่อน');
 return input.matches.map(m=>{
  const w=web.get(m.studentId),s=sheet.get(m.row);
  if(!w||!s||!Number.isSafeInteger(m.row)||m.row<5||!normalize(m.name)||normalize(w.name)!==normalize(m.name)||normalize(s.name)!==normalize(m.name))throw Error('รายชื่อหรือแถวเปลี่ยน กรุณาตรวจจับคู่ใหม่');
  const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=input.webMax;
  const base={studentId:m.studentId,row:m.row,webScore:w.score,sheetScore:s.value};
  if(s.formula)return {...base,state:'protected' as const};
  if(typeof w.submitted!=='boolean'||(w.score!==null&&(!w.submitted||!valid(w.score))))return {...base,state:'invalid' as const};
  const blank=s.value===null||s.value===undefined||s.value==='';
  if(!blank&&!valid(s.value))return {...base,state:'invalid' as const};
  if(w.score!==null&&!blank&&w.score===s.value)return {...base,state:'same' as const};
  if(w.score!==null&&!blank)return {...base,state:'conflict' as const};
  if(input.direction==='import'&&!blank&&valid(s.value)&&w.score===null)return {...base,state:'reviewImport' as const,proposed:s.value};
  if(input.direction==='export'&&blank&&w.submitted&&valid(w.score))return {...base,state:'reviewExport' as const,proposed:w.score};
  return {...base,state:'skip' as const};
 });
}

export type SheetColumn={column:number;label:string;maxScore:number};
export function sheetScoreColumns(headers:unknown[][],formulaColumns:number[]):SheetColumn[]{
 if(headers.length!==4)throw Error('ต้องมีหัวตาราง 4 แถว');
 const blocked=new Set(formulaColumns);
 const result:SheetColumn[]=[];
 let section='',topic='';
 for(let i=3;i<headers[3].length;i++){
  const col=i+1;
  const a=String(headers[0][i]??'').trim(),b=String(headers[1][i]??'').trim(),c=String(headers[2][i]??'').trim();
  if(a){section=a;topic=''}
  if(b)topic=b;
  const max=headers[3][i];
  if(blocked.has(col)||!topic||/รวม|เกรด/.test(section+' '+topic+' '+c)||typeof max!=='number'||!Number.isFinite(max)||max<=0)continue;
  result.push({column:col,label:[section,topic,c].filter(Boolean).join(' · '),maxScore:max});
 }
 return result;
}
export function proposeSheetMatches(web:{studentId:string;name:string}[],sheet:{row:number;name:string}[]):ConfirmedMatch[]{
 const a=web.map(x=>({...x,key:normalize(x.name)})),b=sheet.map(x=>({...x,key:normalize(x.name)}));
 if(a.length!==b.length||new Set(a.map(x=>x.key)).size!==a.length||new Set(b.map(x=>x.key)).size!==b.length||a.some(x=>!x.key)||b.some(x=>!x.key))throw Error('จำนวนหรือชื่อซ้ำ ไม่สามารถจับคู่อัตโนมัติได้');
 const names=new Map(b.map(x=>[x.key,x]));
 return a.map(x=>{const found=names.get(x.key);if(!found)throw Error('ชื่อไม่ตรง กรุณาตรวจสอบรายชื่อทั้งสองระบบ');return {studentId:x.studentId,row:found.row,name:x.name}});
}
