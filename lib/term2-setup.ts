import {collection,doc,getDocsFromServer,getDocFromServer,query,limit,runTransaction,serverTimestamp,type Firestore} from 'firebase/firestore';
import {checkLegacyRegistry,planEnglishTerm2,resolveTerm2Master,type Term2Master,type prepareLegacy} from './migration';
type Prepared=ReturnType<typeof prepareLegacy>;
const kinds=['rooms','subjects','terms'] as const;
type Kind=typeof kinds[number];
type Fields=Record<string,string|boolean>;
const same=(actual:Record<string,unknown>,expected:Fields)=>Object.entries(expected).every(([k,v])=>actual[k]===v);
async function list(db:Firestore,...path:[string,...string[]]){
 const s=await getDocsFromServer(query(collection(db,...path),limit(501)));
 if(s.size>500)throw Error('ข้อมูลเกินขอบเขตตรวจสอบ 500 รายการ');
 return s.docs.map(d=>({id:d.id,data:d.data()}));
}
async function owner(db:Firestore,uid:string){
 const p=await getDocFromServer(doc(db,'profiles',uid));
 if(!p.exists()||p.data().active!==true||p.data().role!=='super_admin')throw Error('ต้องใช้บัญชีเจ้าของระบบที่เปิดใช้งาน');
}
async function ensure(db:Firestore,path:[string,...string[]],fields:Fields,timestamp:boolean,allowCreate=true){
 const ref=doc(db,...path);
 return runTransaction(db,async tx=>{
  const old=await tx.get(ref);
  if(old.exists()){if(!same(old.data(),fields))throw Error('ข้อมูลเดิมไม่ตรงกัน: '+path[0]);return false}
  if(!allowCreate)throw Error('ข้อมูลเดิมหายไป: '+path[0]);
  tx.set(ref,timestamp?{...fields,createdAt:serverTimestamp()}:fields);return true;
 });
}
export async function previewTerm2Setup(db:Firestore,uid:string,prepared:Prepared){
 await owner(db,uid);
 const p=planEnglishTerm2(prepared);
 if(p.unresolved.length||!p.groups.length||!p.studentCount||p.groups.some(g=>!/^\d{1,3}$/.test(g.room)))throw Error('ยังมีนักเรียนหรือรหัสห้องที่ต้องตรวจสอบ');
 const [students,rooms,subjects,terms,courses]=await Promise.all([list(db,'students'),list(db,'rooms'),list(db,'subjects'),list(db,'terms'),list(db,'teachingAssignments')]);
 const registry=checkLegacyRegistry(prepared.roster,students.map(s=>({code:s.id,name:s.data.name,active:s.data.active})));
 if(registry.matched!==p.studentCount)throw Error('ทะเบียนนักเรียนยังไม่ตรงครบ');
 const rows=(r:typeof rooms)=>r.map(d=>({id:d.id,code:d.data.code,name:d.data.name,active:d.data.active}));
 const term=resolveTerm2Master(rows(terms),'term-2569-2','ปีการศึกษา 2569 ภาคเรียน 2',['2569/2','2569 เทอม 2','2569 ภาคเรียน 2','ภาคเรียนที่ 2/2569','ปีการศึกษา 2569 ภาคเรียนที่ 2']);
 const masters=new Map<string,{kind:Kind;record:Term2Master}>();
 const add=(kind:Kind,record:Term2Master)=>masters.set(kind+'/'+record.id,{kind,record});
 add('terms',term);
 const groups=[];
 for(const g of p.groups){
  const room=resolveTerm2Master(rows(rooms),'room-m'+g.level+'-'+g.room,'ม.'+g.level+'/'+g.room,['ม'+g.level+'/'+g.room,'มัธยมศึกษาปีที่ '+g.level+'/'+g.room]);
  const subject=resolveTerm2Master(rows(subjects),'english-'+(g.level==='2'?'4':'6'),g.subject);
  add('rooms',room);add('subjects',subject);
  const fields={teacherUid:uid,roomId:room.id,subjectId:subject.id,termId:term.id,active:true};
  const id=[uid,room.id,subject.id,term.id].join('__');
  const matches=courses.filter(c=>c.data.teacherUid===uid&&c.data.roomId===room.id&&c.data.subjectId===subject.id&&c.data.termId===term.id);
  if(matches.length>1||matches.some(c=>c.id!==id))throw Error('พบรายการมอบหมายซ้ำหรือรหัสไม่ตรง');
  const existing=courses.find(c=>c.id===id);
  if(existing&&!same(existing.data,fields))throw Error('รายการมอบหมายเดิมไม่ตรงหรือถูกเก็บถาวร');
  const roster=existing?await list(db,'teachingAssignments',id,'roster'):[];
  const wanted=new Map(g.students.map(s=>[s.code,s.name]));
  if(roster.some(s=>!wanted.has(s.id)||!same(s.data,{studentId:s.id,name:wanted.get(s.id)!,active:true})))throw Error('รายชื่อในห้องเดิมไม่ตรงกับแผน: '+room.name);
  groups.push({key:g.key,id,room,subject,fields,exists:!!existing,students:g.students,existingRoster:roster.map(s=>s.id).sort()});
 }
 return {uid,term,masters:[...masters.values()],groups,studentCount:p.studentCount};
}
export type Term2Setup=Awaited<ReturnType<typeof previewTerm2Setup>>;
const identity=(p:Term2Setup)=>JSON.stringify({uid:p.uid,masters:p.masters.map(m=>[m.kind,m.record.id,m.record.name]),groups:p.groups.map(g=>[g.id,g.students.map(s=>[s.code,s.name])])});
export async function applyTerm2Setup(db:Firestore,uid:string,prepared:Prepared,approved:Term2Setup,progress:(message:string)=>void){
 const p=await previewTerm2Setup(db,uid,prepared);
 if(identity(p)!==identity(approved))throw Error('ข้อมูลเปลี่ยนหลังตรวจแผน กรุณาตรวจใหม่');
 let created=0,linked=0;
 for(const {kind,record} of p.masters){
  if(await ensure(db,[kind,record.id],{code:record.id,name:record.name,active:true},true,!record.exists))created++;
 }
 for(const g of p.groups){
  if(await ensure(db,['teachingAssignments',g.id],g.fields,true,!g.exists))created++;
  for(const s of g.students){
   if(await ensure(db,['teachingAssignments',g.id,'roster',s.code],{studentId:s.code,name:s.name,active:true},false))linked++;
  }
  progress('ตรวจ/ผูกห้อง '+g.room.name+' แล้ว · เพิ่มรายชื่อในรายวิชา '+linked+' คน');
 }
 const verified=await previewTerm2Setup(db,uid,prepared);
 if(identity(verified)!==identity(p)||verified.masters.some(m=>!m.record.exists)||verified.groups.some(g=>!g.exists||g.existingRoster.length!==g.students.length))throw Error('ตรวจสอบหลังบันทึกไม่ครบ');
 return {created,linked,students:verified.studentCount,groups:verified.groups.length};
}
