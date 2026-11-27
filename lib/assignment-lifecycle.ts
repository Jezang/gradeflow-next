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
