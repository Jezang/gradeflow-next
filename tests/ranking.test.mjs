import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize,rate,place,provisionalGrade} from '../lib/ranking.ts';
const students=[{id:'A',name:'A'},{id:'B',name:'B'}];
const sub=(id,score,submitted=true)=>({id,score,submitted});
const course=(id,roomId,work)=>({id,roomId,students,work});
test('all active student-work pairs are denominators; cancellation and strangers excluded',()=>{const r=summarize([course('c','R1',[{id:'w',maxScore:10,submissions:[sub('A',10),sub('B',null,false),sub('stranger',10)]},{id:'w2',maxScore:20,submissions:[sub('A',null),sub('B',15)]}])]);assert.equal(rate(r.students[0]),1);assert.equal(rate(r.students[1]),.5);assert.equal(rate(r.rooms[0]),.75);assert.equal(r.students[0].points,10);assert.equal(provisionalGrade(r.students[0],[80,75,70,65,60,55,50]),null);});
test('ties share rank and multiple courses aggregate by student id',()=>{const w={id:'w',maxScore:10,submissions:[sub('A',8),sub('B',10)]};const r=summarize([course('c','R1',[w]),course('d','R2',[w])]);assert.equal(r.students.length,2);assert.equal(r.students[0].expected,2);assert.equal(place(r.students,0),1);assert.equal(place(r.students,1),1);assert.equal(provisionalGrade(r.students[0],[80,75,70,65,60,55,50]),'4');});
test('no work is not a ranked zero; zero score is graded',()=>{assert.equal(summarize([course('c','R1',[])]).students.length,0);const r=summarize([course('c','R1',[{id:'w',maxScore:10,submissions:[sub('A',0)]}])]);assert.equal(provisionalGrade(r.students[0],[80,75,70,65,60,55,50]),'0');});
