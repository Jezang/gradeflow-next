export type Attendance='leave'|'absent'|'missing';
export function timestampMillis(value:unknown):number|null{
 if(!value||typeof (value as {toMillis?:unknown}).toMillis!=='function')return null;
 const n=(value as {toMillis:()=>number}).toMillis();return Number.isFinite(n)?n:null;
}
export function parseBangkokDate(value:string):number|null{
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('วันเวลาไม่ถูกต้อง');
 const n=Date.parse(value+':00+07:00');
 if(!Number.isFinite(n)||bangkokInput(n)!==value)throw Error('วันเวลาไม่ถูกต้อง');
 return n;
}
export function bangkokInput(ms:number|null){return ms===null?'':new Date(ms+7*3600000).toISOString().slice(0,16)}
export function validateDeadlines(due:string,revision:string){const a=parseBangkokDate(due),b=parseBangkokDate(revision);if(b!==null&&(a===null||b<a))throw Error('วันแก้งานต้องไม่ก่อนกำหนดส่ง');return {a,b}}
export function attendanceFor(submitted:boolean,manual:unknown,legacy:unknown):'leave'|'absent'|undefined{
 if(submitted||manual==='missing')return undefined;
 const value=manual??legacy;return value==='leave'||value==='absent'?value:undefined;
}
export function deadlineState(submitted:boolean,deadline:number|null,revision:number|null,now:number){
 if(submitted)return 'submitted';if(deadline===null)return 'unscheduled';if(now<=deadline)return 'open';if(revision!==null&&now<=revision)return 'revision';return 'overdue';
}
export const deadlineLabels={submitted:'ส่งแล้ว',unscheduled:'ไม่กำหนดวันส่ง',open:'ยังไม่ถึงกำหนด',revision:'ช่วงแก้งาน',overdue:'เลยกำหนด'} as const;
export const attendanceLabels={leave:'ลา',absent:'ขาด',missing:'ยังไม่ส่ง'} as const;


/** Never select an arbitrary term or teacher when subject and room are ambiguous. */
export function resolveCheckingCourse<T extends {id:string;data:{active?:unknown;subjectId?:unknown;roomId?:unknown}}>(rows:readonly T[],subject:string,room:string):string{
 if(!subject||!room)return '';
 const candidates=rows.filter(row=>row.data.active===true&&row.data.subjectId===subject&&row.data.roomId===room);
 return candidates.length===1?candidates[0].id:'';
}
