import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalWorkEligible} from '../lib/student-historical-work.ts';
const windows=[{studentId:'s1',termId:'t1',courseId:'old',from:10,until:20},{studentId:'s1',termId:'t1',courseId:'new',from:20,until:null}];
const input={studentId:'s1',termId:'t1',courseId:'old',assignedAt:15};
test('old work remains eligible after transfer but new old-room work does not',()=>{assert.equal(historicalWorkEligible(windows,input),true);assert.equal(historicalWorkEligible(windows,{...input,assignedAt:20}),false);assert.equal(historicalWorkEligible(windows,{...input,courseId:'new',assignedAt:20}),true)});
test('other student and term denied',()=>{assert.equal(historicalWorkEligible(windows,{...input,studentId:'s2'}),false);assert.equal(historicalWorkEligible(windows,{...input,termId:'t2'}),false)});
