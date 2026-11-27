import test from 'node:test';
import assert from 'node:assert/strict';
import {ownPortalRecords} from '../lib/student-portal-access.ts';
const bindings=[{uid:'u1',studentId:'s1',active:true},{uid:'u2',studentId:'s2',active:true}];
const work={id:'w',course:'demo',title:'demo',maxScore:10,score:0,submitted:true,deadline:null,revisionDeadline:null,privateNote:'hidden'};
const rows=[{studentId:'s1',termId:'t1',work},{studentId:'s2',termId:'t1',work:{...work,score:9}},{studentId:'s1',termId:'t2',work:{...work,score:8}}];
test('own student and term only, zero retained and extra fields removed',()=>{const result=ownPortalRecords('u1',bindings,rows,'t1');assert.equal(result.length,1);assert.equal(result[0].score,0);assert.equal('privateNote' in result[0],false)});
test('unauthenticated, inactive and ambiguous bindings denied',()=>{for(const uid of [null,'unknown'])assert.deepEqual(ownPortalRecords(uid,bindings,rows,'t1'),[]);assert.deepEqual(ownPortalRecords('u1',[{...bindings[0],active:false}],rows,'t1'),[]);assert.deepEqual(ownPortalRecords('u1',[...bindings,{uid:'u3',studentId:'s1',active:true}],rows,'t1'),[])});
