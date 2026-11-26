export type GradeCategory = {weight:number; earned:number; possible:number; complete:boolean};
export function weightedGradePreview(categories:GradeCategory[]):number|null {
 if(!categories.length||categories.some(c=>![c.weight,c.earned,c.possible].every(Number.isFinite)||c.weight<0||c.possible<0||c.earned<0||c.earned>c.possible))return null;
 if(Math.abs(categories.reduce((s,c)=>s+c.weight,0)-100)>1e-8)return null;
 if(categories.some(c=>c.weight>0&&(!c.complete||c.possible===0)))return null;
 return categories.reduce((s,c)=>s+(c.weight===0?0:c.weight*c.earned/c.possible),0);
}

export type GradeWork = { id: string; title: string; maxScore: number; scores: Map<string, number> };

export function summarizeWeightedGrades(
 students: { id: string; name: string }[],
 works: GradeWork[],
 categories: { weight: number; workIds: string[] }[],
) {
 const categorized = categories.flatMap(category => category.workIds);
 const workById = new Map(works.map(work => [work.id, work]));
 if (!works.length || categorized.length !== works.length ||
     new Set(categorized).size !== works.length || categorized.some(id => !workById.has(id)) ||
     categories.some(category => !Number.isFinite(category.weight) || category.weight < 0 ||
       (category.weight > 0 && category.workIds.length === 0)) ||
     Math.abs(categories.reduce((sum, category) => sum + category.weight, 0) - 100) > 1e-8) return null;

 return students.map(student => {
  const scores = categories.map(category => {
   let earned = 0;
   let possible = 0;
   let graded = 0;
   for (const id of category.workIds) {
    const work = workById.get(id)!;
    const score = work.scores.get(student.id);
    possible += work.maxScore;
    if (score !== undefined && Number.isFinite(score) && score >= 0 && score <= work.maxScore) {
     earned += score;
     graded++;
    }
   }
   return { weight: category.weight, earned, possible, graded, expected: category.workIds.length,
    complete: graded === category.workIds.length };
  });
  return { ...student, scores, percent: weightedGradePreview(scores) };
 });
}
