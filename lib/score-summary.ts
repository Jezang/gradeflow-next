export type ScoreSummaryRow={id:string;name:string;no?:number;submitted:boolean;score:number|null;attendance?:'leave'|'absent'};
export type SummaryState='graded'|'pending'|'missing'|'leave'|'absent';
export function summaryState(row:ScoreSummaryRow):SummaryState{
 if(row.submitted)return row.score===null?'pending':'graded';
 return row.attendance==='leave'||row.attendance==='absent'?row.attendance:'missing';
}
export function summarizeScores(rows:ScoreSummaryRow[]){
 const counts={graded:0,pending:0,missing:0,leave:0,absent:0};let points=0;
 for(const row of rows){const state=summaryState(row);counts[state]++;if(state==='graded')points+=row.score!}
 return {...counts,total:rows.length,submitted:counts.graded+counts.pending,average:counts.graded?points/counts.graded:null};
}
export function orderedScoreRows(rows:ScoreSummaryRow[]){
 return [...rows].sort((a,b)=>(a.no??Infinity)-(b.no??Infinity)||a.name.localeCompare(b.name,'th')||a.id.localeCompare(b.id));
}
export function scoreColumn(rows:ScoreSummaryRow[]){
 const sorted=orderedScoreRows(rows);
 if(!sorted.length||new Set(sorted.map(r=>r.id)).size!==sorted.length||sorted.some((r,i)=>r.no!==i+1))throw Error('ต้องยืนยันเลขที่ 1 ถึงจำนวนนักเรียนครบและไม่ซ้ำก่อนคัดลอกคะแนน');
 if(sorted.some(r=>summaryState(r)==='graded'&&(!Number.isFinite(r.score)||r.score!<0)))throw Error('คะแนนไม่ถูกต้อง');
 const values=sorted.map(r=>summaryState(r)==='graded'?String(r.score):'');
 // HTML preserves even leading, trailing and entirely empty rows; text is a secondary representation.
 return {count:values.length,plain:values.join('\n'),html:'<table><tbody>'+values.map(v=>'<tr><td>'+v+'</td></tr>').join('')+'</tbody></table>'};
}
