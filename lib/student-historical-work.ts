export type MembershipWindow=Readonly<{studentId:string;termId:string;courseId:string;from:number;until:number|null}>;
export function historicalWorkEligible(windows:readonly MembershipWindow[],input:{studentId:string;termId:string;courseId:string;assignedAt:number}):boolean{
 if(!Number.isSafeInteger(input.assignedAt)||input.assignedAt<0)throw Error('Invalid assignment time');
 const own=windows.filter(w=>w.studentId===input.studentId&&w.termId===input.termId&&w.courseId===input.courseId);
 for(const w of own)if(!Number.isSafeInteger(w.from)||w.from<0||(w.until!==null&&(!Number.isSafeInteger(w.until)||w.until<=w.from)))throw Error('Invalid membership window');
 return own.some(w=>input.assignedAt>=w.from&&(w.until===null||input.assignedAt<w.until));
}
