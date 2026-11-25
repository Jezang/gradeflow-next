export type Student={id:string;name:string};
export type Work={id:string;maxScore:number;submissions:{id:string;submitted:boolean;score:number|null}[]};
export type Course={id:string;roomId:string;students:Student[];work:Work[]};
export type Summary={id:string;name:string;expected:number;submitted:number;graded:number;points:number;maximum:number};
const empty=(id:string,name:string):Summary=>({id,name,expected:0,submitted:0,graded:0,points:0,maximum:0});
export const rate=(s:Summary)=>s.expected?s.submitted/s.expected:0;
export function rank(rows:Summary[]){return rows.filter(s=>s.expected>0).sort((a,b)=>b.submitted*a.expected-a.submitted*b.expected||a.name.localeCompare(b.name,'th')||a.id.localeCompare(b.id));}
export function place(rows:Summary[],i:number){const s=rows[i];return 1+rows.findIndex(x=>x.submitted*s.expected===s.submitted*x.expected);}
export function summarize(courses:Course[]){
 const people=new Map<string,Summary>(),rooms=new Map<string,Summary>();
 for(const c of courses){
  const room=rooms.get(c.roomId)||empty(c.roomId,c.roomId);rooms.set(c.roomId,room);
  const submissions=c.work.map(w=>({max:w.maxScore,byId:new Map(w.submissions.map(s=>[s.id,s]))}));
  for(const student of c.students){
   const person=people.get(student.id)||empty(student.id,student.name);people.set(student.id,person);
   for(const w of submissions){
    const sub=w.byId.get(student.id);
    for(const row of [person,room]){
     row.expected++;row.maximum+=w.max;
     if(sub?.submitted===true){row.submitted++;if(typeof sub.score==='number'&&Number.isFinite(sub.score)&&sub.score>=0&&sub.score<=w.max){row.graded++;row.points+=sub.score;}}
    }
   }
  }
 }
 return {students:rank([...people.values()]),rooms:rank([...rooms.values()]),allStudents:[...people.values()]};
}
export function provisionalGrade(s:Summary,thresholds:number[]){if(!s.expected||s.graded!==s.expected||!s.maximum)return null;const percent=s.points/s.maximum*100;const grades=['4','3.5','3','2.5','2','1.5','1'];return grades[thresholds.findIndex(t=>percent>=t)]||'0';}
