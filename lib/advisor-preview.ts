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

export function confirmedRosterNumbers(roster:{id:string;name:string}[],history:{id:string;name:string;no:unknown}[]){
 const names=new Map(roster.map(r=>[r.id,r.name]));
 const candidates=new Map<string,Set<number>>();
 for(const row of history){
  const no=String(row.no??'').trim();
  if(names.get(row.id)!==row.name||!/^\d{1,3}$/.test(no)||Number(no)<1)continue;
  const set=candidates.get(row.id)??new Set<number>();set.add(Number(no));candidates.set(row.id,set);
 }
 const numbers=new Map<string,number>();
 const counts=new Map<number,number>();
 for(const [id,set] of candidates)if(set.size===1){const no=[...set][0];numbers.set(id,no);counts.set(no,(counts.get(no)??0)+1)}
 for(const [id,no] of numbers)if(counts.get(no)!>1)numbers.delete(id);
 return numbers;
}
