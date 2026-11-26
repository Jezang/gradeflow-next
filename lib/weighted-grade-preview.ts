export type GradeCategory = {weight:number; earned:number; possible:number; complete:boolean};
export function weightedGradePreview(categories:GradeCategory[]):number|null {
 if(!categories.length||categories.some(c=>![c.weight,c.earned,c.possible].every(Number.isFinite)||c.weight<0||c.possible<0||c.earned<0||c.earned>c.possible))return null;
 if(Math.abs(categories.reduce((s,c)=>s+c.weight,0)-100)>1e-8)return null;
 if(categories.some(c=>c.weight>0&&(!c.complete||c.possible===0)))return null;
 return categories.reduce((s,c)=>s+(c.weight===0?0:c.weight*c.earned/c.possible),0);
}
