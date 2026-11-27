export type AssignmentState = {title:string;maxScore:number;active:boolean;importPending?:boolean};
export type AssignmentAction = {kind:'rename';title:string}|{kind:'archive'}|{kind:'restore'};
/** Pure planning only; persistence requires authorized transaction and audit. */
export function planAssignmentChange(current:AssignmentState, action:AssignmentAction):Partial<AssignmentState>{
 if(current.importPending)throw Error('Import pending');
 if(action.kind==='rename'){
  if(!current.active)throw Error('Inactive assignment');
  const title=action.title.trim();
  if(!title||title.length>160)throw Error('Invalid title');
  return title===current.title?{}:{title};
 }
 if(action.kind==='archive')return current.active?{active:false}:{};
 if(action.kind==='restore')return current.active?{}:{active:true};
 throw Error('Unknown action');
}

/** Snapshot must be complete and confirmed; production callers need atomic authorization. */
export function planScoreCeiling(current:AssignmentState, next:number, scores:readonly (number|null)[], complete:boolean):Partial<AssignmentState>{
 if(!complete||!current.active||current.importPending)throw Error('Unavailable assignment or incomplete scores');
 if(!Number.isFinite(next)||next<=0||next>1000)throw Error('Invalid maximum');
 if(scores.some(s=>s!==null&&(!Number.isFinite(s)||s<0||s>next)))throw Error('Existing score exceeds maximum or is invalid');
 return next===current.maxScore?{}:{maxScore:next};
}
export function planAssignmentAudit(before:AssignmentState, patch:Partial<AssignmentState>, actor:string, at:number){
 if(!actor.trim()||!Number.isFinite(at))throw Error('Invalid audit metadata');
 if(Object.keys(patch).length===0)return null;
 return {before:{...before},after:{...before,...patch},actor,at};
}
