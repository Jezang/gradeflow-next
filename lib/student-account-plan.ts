export type AccountBinding=Readonly<{uid:string;studentId:string;active:boolean}>;
export type AccountOwner=Readonly<{studentId:string;uid:string}>;
export type AccountPlan=Readonly<{binding:AccountBinding;owner:AccountOwner}>;
const valid=(s:string)=>/^[A-Za-z0-9_-]{1,128}$/.test(s);
/** Trusted backend must re-read both records and apply the plan atomically. No client writes. */
export function planStudentAccount(input:{uid:string;studentId:string;active:boolean;studentExists:boolean;authExists:boolean;binding:AccountBinding|null;owner:AccountOwner|null}):AccountPlan{
 const {uid,studentId,active,binding,owner}=input;
 if(!valid(uid)||!valid(studentId)||!input.studentExists||!input.authExists)throw Error('Invalid account identity');
 if(binding&&(binding.uid!==uid||binding.studentId!==studentId))throw Error('Account already bound');
 if(owner&&(owner.studentId!==studentId||owner.uid!==uid))throw Error('Student already bound');
 if(Boolean(binding)!==Boolean(owner))throw Error('Inconsistent binding');
 if(!active&&!binding)throw Error('Cannot suspend unbound account');
 return {binding:{uid,studentId,active},owner:{studentId,uid}};
}
