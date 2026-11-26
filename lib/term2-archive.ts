import {collection,doc,getDocFromServer,getDocsFromServer,query,limit,runTransaction,serverTimestamp,type Firestore,type DocumentReference,type DocumentData} from 'firebase/firestore';
import {planTerm2Archives,type prepareLegacy} from './migration';
import {previewTerm2Setup} from './term2-setup';
type Prepared=ReturnType<typeof prepareLegacy>;
type Item=ReturnType<typeof planTerm2Archives>['items'][number];
const equal=(a:unknown,b:unknown):boolean=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&equal(v,(b as Record<string,unknown>)[k])));
const same=(a:DocumentData,b:Record<string,unknown>)=>Object.entries(b).every(([k,v])=>equal(a[k],v));
async function rows(ref:DocumentReference,path:string){
 const snap=await getDocsFromServer(query(collection(ref,path),limit(501)));
 if(snap.size>500||snap.metadata.hasPendingWrites)throw Error('ข้อมูลยังไม่พร้อมหรือเกิน 500 รายการ');
 return snap.docs;
}
async function ensure(ref:DocumentReference,value:DocumentData,created=false){
 await runTransaction(ref.firestore,async tx=>{
  const old=await tx.get(ref);
  if(old.exists()){if(!same(old.data(),value))throw Error('พบข้อมูลเดิมไม่ตรงกัน ไม่เขียนทับ')}
  else tx.set(ref,created?{...value,createdAt:serverTimestamp()}:value);
 });
}
// Limit each transaction to four rows to stay within Firestore rules access budgets.
async function ensureRows(entries:{ref:DocumentReference;value:DocumentData;timestamp?:boolean}[]){
 for(let i=0;i<entries.length;i+=4){
  const chunk=entries.slice(i,i+4);
  await runTransaction(chunk[0].ref.firestore,async tx=>{
   const existing=await Promise.all(chunk.map(x=>tx.get(x.ref)));
   for(let j=0;j<chunk.length;j++){
    const x=chunk[j],old=existing[j];
    if(old.exists()){if(!same(old.data(),x.value))throw Error('พบข้อมูลเดิมไม่ตรงกัน ไม่เขียนทับ')}
    else tx.set(x.ref,x.timestamp?{...x.value,updatedAt:serverTimestamp()}:x.value);
   }
  });
 }
}
function header(item:Item,uid:string){
 const w=item.work;
 return {title:w.title,maxScore:w.maxScore,due:w.due,level:w.level,room:w.room,subject:w.subject,studentCount:item.students.length,recordCount:item.recordCount,createdBy:uid};
}
function archiveRef(db:Firestore,courseId:string,item:Item){return doc(db,'legacyArchives',courseId,'assignments',item.work.id)}
function liveRef(db:Firestore,courseId:string,item:Item){return doc(db,'teachingAssignments',courseId,'work','legacy_'+item.work.id)}
async function inspectArchive(db:Firestore,uid:string,courseId:string,item:Item){
 const base=archiveRef(db,courseId,item);
 const [h,stored]=await Promise.all([getDocFromServer(base),rows(base,'students')]);
 const expected=new Map(item.students.map(s=>[s.code,s.value]));
 if((h.exists()&&!same(h.data(),header(item,uid)))||(!h.exists()&&stored.length)||stored.some(r=>!equal(r.data(),expected.get(r.id))))throw Error('สำเนาประวัติเดิมไม่ตรงกับไฟล์: '+item.room+' '+item.work.title);
 return {complete:h.exists()&&stored.length===expected.size,stored:stored.length};
}
export async function previewTerm2ArchiveBatch(db:Firestore,uid:string,prepared:Prepared){
 const [setup,plan]=await Promise.all([previewTerm2Setup(db,uid,prepared),Promise.resolve(planTerm2Archives(prepared))]);
 if(setup.masters.some(m=>!m.record.exists)||setup.groups.some(g=>!g.exists||g.existingRoster.length!==g.students.length))throw Error('กรุณาสร้างและตรวจห้องเรียนให้ครบก่อน');
 const courseByGroup=new Map(setup.groups.map(g=>[g.key,g.id]));
 const targets=[];
 for(const item of plan.items){
  const courseId=courseByGroup.get(item.groupKey);
  if(!courseId)throw Error('ไม่พบรายวิชาปลายทาง');
  const state=await inspectArchive(db,uid,courseId,item);
  targets.push({item,courseId,...state});
 }
 return {targets,recordCount:plan.recordCount,workCount:plan.workCount,studentCount:plan.studentCount};
}
export type Term2ArchiveBatch=Awaited<ReturnType<typeof previewTerm2ArchiveBatch>>;
const identity=(batch:Term2ArchiveBatch)=>JSON.stringify(batch.targets.map(x=>[x.courseId,x.item]));
export async function archiveTerm2Batch(db:Firestore,uid:string,prepared:Prepared,approved:Term2ArchiveBatch,progress:(text:string)=>void){
 const batch=await previewTerm2ArchiveBatch(db,uid,prepared);
 if(identity(batch)!==identity(approved))throw Error('แผนเปลี่ยน กรุณาตรวจใหม่');
 let done=0;
 for(const {item,courseId,complete} of batch.targets){
  if(!complete){
   const base=archiveRef(db,courseId,item);
   await ensure(base,header(item,uid),true);
   await ensureRows(item.students.map(s=>({ref:doc(base,'students',s.code),value:s.value})));
   if(!(await inspectArchive(db,uid,courseId,item)).complete)throw Error('สำเนายังไม่ครบ');
  }
  done+=item.recordCount;progress('ตรวจสำเนาประวัติแล้ว '+done+' / '+batch.recordCount+' รายการ');
 }
 const checked=await previewTerm2ArchiveBatch(db,uid,prepared);
 if(identity(checked)!==identity(batch)||checked.targets.some(x=>!x.complete))throw Error('ตรวจสำเนาหลังบันทึกไม่ครบ');
 return checked;
}
function meta(item:Item){return {title:item.work.title,maxScore:item.work.maxScore,legacyId:item.work.id,legacyDue:item.work.due}}
function results(item:Item,uid:string){
 return item.students.flatMap(s=>s.value.record?[{code:s.code,value:{studentId:s.code,score:s.value.record.score,submitted:s.value.record.submitted,legacy:s.value.record,updatedBy:uid}}]:[]);
}
async function inspectLive(db:Firestore,uid:string,courseId:string,item:Item){
 const target=liveRef(db,courseId,item);
 const [old,stored,works]=await Promise.all([getDocFromServer(target),rows(target,'submissions'),rows(doc(db,'teachingAssignments',courseId),'work')]);
 if(works.some(w=>w.id!==target.id&&String(w.data().title).trim()===item.work.title.trim()))throw Error('มีงานชื่อเดียวกันใน '+item.room+' กรุณาตรวจงานซ้ำก่อน');
 const expected=new Map(results(item,uid).map(r=>[r.code,r.value]));
 if(!old.exists()&&stored.length)throw Error('พบข้อมูลคะแนนที่ไม่มีงาน');
 if(old.exists()){
  const d=old.data();
  if(!same(d,meta(item))||d.createdBy!==uid||!((d.active===false&&d.importPending===true)||(d.active===true&&d.importPending===false)))throw Error('งานปลายทางไม่ตรงกัน ไม่เขียนทับ');
 }
 if(stored.some(r=>!expected.has(r.id)||!same(r.data(),expected.get(r.id)!)))throw Error('มีคะแนนเดิมหรือคะแนนที่ถูกแก้ไข ไม่เขียนทับ');
 const active=old.exists()&&old.data().active===true;
 if(active&&stored.length!==expected.size)throw Error('งานที่เปิดใช้แล้วมีคะแนนไม่ครบ');
 return {active,complete:stored.length===expected.size};
}
export async function promoteTerm2Batch(db:Firestore,uid:string,prepared:Prepared,approved:Term2ArchiveBatch,selected:string[],confirmedScope:string[],progress:(text:string)=>void){
 const batch=await previewTerm2ArchiveBatch(db,uid,prepared);
 if(identity(batch)!==identity(approved)||batch.targets.some(x=>!x.complete))throw Error('สำเนาประวัติยังไม่ครบหรือแผนเปลี่ยน');
 const wanted=new Set(selected);
 const targets=batch.targets.filter(x=>wanted.has(x.item.key));
 if(!wanted.size||targets.length!==wanted.size)throw Error('กรุณาเลือกงานที่ต้องการเปิดใช้');
 if(targets.some(x=>x.item.needsScopeConfirmation&&!confirmedScope.includes(x.item.key)))throw Error('กรุณายืนยันขอบเขตงานที่มีรายชื่อขาดบันทึก');
 for(const {item,courseId} of targets)await inspectLive(db,uid,courseId,item);
 let done=0;
 for(const {item,courseId} of targets){
  const state=await inspectLive(db,uid,courseId,item);
  const target=liveRef(db,courseId,item);
  if(!state.active){
   await ensure(target,{...meta(item),createdBy:uid,active:false,importPending:true},true);
   await ensureRows(results(item,uid).map(r=>({ref:doc(target,'submissions',r.code),value:r.value,timestamp:true})));
   if(!(await inspectLive(db,uid,courseId,item)).complete)throw Error('ตรวจคะแนนหลังบันทึกไม่ครบ');
   const setup=await previewTerm2Setup(db,uid,prepared);
   const group=setup.groups.find(g=>g.key===item.groupKey);
   if(!group?.exists||group.id!==courseId||group.existingRoster.length!==group.students.length)throw Error('รายชื่อนักเรียนเปลี่ยนก่อนเปิดงาน');
   await runTransaction(db,async tx=>{
    const old=await tx.get(target);
    if(!old.exists()||!same(old.data(),{...meta(item),active:false,importPending:true,createdBy:uid}))throw Error('สถานะงานเปลี่ยน');
    tx.update(target,{active:true,importPending:false});
   });
  }
  if(!(await inspectLive(db,uid,courseId,item)).active)throw Error('งานยังไม่เปิดใช้');
  done+=item.recordCount;progress('เปิดใช้และตรวจคะแนนแล้ว '+done+' รายการ');
 }
 return {records:done,groups:targets.length};
}
