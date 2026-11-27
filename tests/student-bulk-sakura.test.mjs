import test from 'node:test';
import assert from 'node:assert/strict';
import {planStudentProvision} from '../lib/student-provision-plan.ts';
import {sakuraMilestones} from '../lib/student-sakura-progress.ts';
test('bulk plan excludes inactive and rejects duplicate login aliases',()=>{const row={studentId:'s1',studentNumber:'001',active:true};assert.equal(planStudentProvision([row,{studentId:'s2',studentNumber:'002',active:false}]).length,1);assert.throws(()=>planStudentProvision([row,{...row,studentId:'s2'}]));assert.equal(planStudentProvision([row])[0].requiresActivation,true)});
test('empty work is not a champion; zero score counts as graded',()=>{assert.deepEqual(sakuraMilestones([]).badges,[]);const result=sakuraMilestones([{submitted:true,score:0}]);assert.equal(result.stage,'bloom');assert.equal(result.graded,1);assert.ok(result.badges.includes('all-graded'))});
