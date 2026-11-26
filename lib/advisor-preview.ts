export type AdvisorRoster={id:string;name:string;active:boolean};
export type AdvisorWork={id:string;title:string;maxScore:number;active:boolean;records:{id:string;submitted:boolean;score:number|null}[]};
export function advisorPreview(roster:AdvisorRoster[],works:AdvisorWork[]){
 const active=roster.filter(s=>s.active===true);
 const assignments=works.filter(w=>w.active===true);
 if(new Set(active.map(s=>s.id)).size!==active.length||new Set(assignments.map(w=>w.id)).size!==assignments.length)throw Error('พบรหัสซ้ำ');
 const lookup=assignments.map(w=>{
  if(!Number.isFinite(w.maxScore)||w.maxScore<=0)throw Error('คะแนนเต็มไม่ถูกต้อง');
  if(new Set(w.records.map(r=>r.id)).size!==w.records.length)throw Error('พบบันทึกซ้ำ');
  return {work:w,records:new Map(w.records.map(r=>[r.id,r]))};
 });
 const students=active.map(s=>{
  let points=0,possible=0,graded=0,missing=0,pending=0;
  const cells=lookup.map(({work,records})=>{
   const r=records.get(s.id);
   if(!r||r.submitted===false){missing++;return {workId:work.id,state:'missing' as const,score:null}}
   if(r.submitted!==true)throw Error('สถานะไม่ถูกต้อง');
   if(r.score===null){pending++;return {workId:work.id,state:'pending' as const,score:null}}
   if(!Number.isFinite(r.score)||r.score<0||r.score>work.maxScore)throw Error('คะแนนไม่ถูกต้อง');
   points+=r.score;possible+=work.maxScore;graded++;
   return {workId:work.id,state:'graded' as const,score:r.score};
  });
  return {id:s.id,name:s.name,points,possible,graded,missing,pending,cells};
 });
 return {works:assignments.map(({id,title,maxScore})=>({id,title,maxScore})),students};
}
