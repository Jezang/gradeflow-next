// Pure planning model: no database writes, credentials or production access.
export type Enrollment = Readonly<{studentId:string;termId:string;roomId:string;no:number}>;
export type StudentBinding = Readonly<{uid:string;studentId:string;active:boolean}>;
const validId=(v:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(v);
export function boundStudent(uid:string, bindings:readonly StudentBinding[]):string|null {
 if(!validId(uid))return null;
 const own=bindings.filter(b=>b.uid===uid&&b.active===true);
 if(own.length!==1||!validId(own[0].studentId))return null;
 return bindings.filter(b=>b.active===true&&b.studentId===own[0].studentId).length===1?own[0].studentId:null;
}
export function planEnrollment(rows:readonly Enrollment[], next:Enrollment):Enrollment[] {
 const valid=(r:Enrollment)=>validId(r.studentId)&&validId(r.termId)&&validId(r.roomId)&&Number.isSafeInteger(r.no)&&r.no>=1&&r.no<=500;
 if(!valid(next)||rows.some(r=>!valid(r)))throw Error('Invalid enrollment');
 const identities=new Set<string>(),slots=new Set<string>();
 for(const r of rows){
  const identity=JSON.stringify([r.studentId,r.termId]),slot=JSON.stringify([r.termId,r.roomId,r.no]);
  if(identities.has(identity)||slots.has(slot))throw Error('Ambiguous enrollment');
  identities.add(identity);slots.add(slot);
 }
 const previous=rows.find(r=>r.studentId===next.studentId&&r.termId===next.termId);
 // Only current-term room positions change. Historical terms and student IDs stay intact.
 const remaining=rows.filter(r=>r!==previous).map(r=>previous&&r.termId===previous.termId&&r.roomId===previous.roomId&&r.no>previous.no?{...r,no:r.no-1}:{...r});
 const target=remaining.filter(r=>r.termId===next.termId&&r.roomId===next.roomId);
 if(next.no>target.length+1||target.some((r)=>r.no>target.length))throw Error('Room numbering requires reconciliation');
 const result=remaining.map(r=>r.termId===next.termId&&r.roomId===next.roomId&&r.no>=next.no?{...r,no:r.no+1}:r);
 if(result.some(r=>r.no>500))throw Error('Room capacity exceeded');
 return [...result,{...next}];
}
export type StudentWork = Readonly<{id:string;course:string;title:string;maxScore:number;score:number|null;submitted:boolean;attendance?:'leave'|'absent';deadline:number|null;revisionDeadline:number|null}>;
export function studentProgress(works:readonly StudentWork[]){
 const graded=works.filter(w=>w.submitted&&w.score!==null);
 return {total:works.length,submitted:works.filter(w=>w.submitted).length,outstanding:works.filter(w=>!w.submitted).length,points:graded.reduce((s,w)=>s+(w.score??0),0),possible:graded.reduce((s,w)=>s+w.maxScore,0)};
}
export function studentWorkState(w:StudentWork,now:number){
 if(w.submitted)return w.score===null?'pending':'graded';
 if(w.attendance)return w.attendance;
 if(w.deadline!==null&&now>w.deadline)return w.revisionDeadline!==null&&now<=w.revisionDeadline?'revision':'overdue';
 return 'missing';
}
