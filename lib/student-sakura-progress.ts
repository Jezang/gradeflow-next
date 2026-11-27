import type {StudentWork} from './student-foundation';
export function sakuraMilestones(works:readonly StudentWork[]){
 const total=works.length,submitted=works.filter(w=>w.submitted).length;
 const graded=works.filter(w=>w.submitted&&w.score!==null).length;
 const ratio=total?submitted/total:0;
 return {total,submitted,graded,stage:total===0?'seed':ratio===1?'bloom':ratio>=.5?'blossom':ratio>0?'sprout':'seed',badges:[...(submitted>0?['first-submission']:[]),...(total>0&&submitted===total?['all-submitted']:[]),...(total>0&&graded===total?['all-graded']:[])]};
}
