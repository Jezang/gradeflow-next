import test from 'node:test';
import assert from 'node:assert/strict';
import {planAssignmentChange} from '../lib/assignment-lifecycle.ts';
const original={title:'Synthetic worksheet',maxScore:10,active:true};
test('rename preserves score scale and identity by returning only title',()=>{assert.deepEqual(planAssignmentChange(original,{kind:'rename',title:' New '}),{title:'New'});assert.equal(original.title,'Synthetic worksheet')});
test('archive and restore preserve existing fields and zero scores',()=>{const row={...original,id:'synthetic',submissions:[{score:0},{score:null}]};const archived={...row,...planAssignmentChange(row,{kind:'archive'})};assert.equal(archived.active,false);assert.deepEqual({...archived,...planAssignmentChange(archived,{kind:'restore'})},row)});
test('reject pending imports and invalid names',()=>{for(const kind of ['archive','restore','rename'])assert.throws(()=>planAssignmentChange({...original,importPending:true},{kind,title:'New'}));assert.throws(()=>planAssignmentChange(original,{kind:'rename',title:' '}));assert.throws(()=>planAssignmentChange({...original,active:false},{kind:'rename',title:'New'}))});
test('no-op transitions',()=>{assert.deepEqual(planAssignmentChange(original,{kind:'restore'}),{});assert.deepEqual(planAssignmentChange(original,{kind:'rename',title:original.title}),{});assert.deepEqual(planAssignmentChange({...original,active:false},{kind:'archive'}),{})});

import {planScoreCeiling,planAssignmentAudit} from '../lib/assignment-lifecycle.ts';
test('ceiling preserves zero and pending scores',()=>{assert.deepEqual(planScoreCeiling(original,8,[0,null,8],true),{maxScore:8});assert.throws(()=>planScoreCeiling(original,7,[8],true));assert.throws(()=>planScoreCeiling(original,20,[],false));for(const n of [0,NaN,Infinity,1001])assert.throws(()=>planScoreCeiling(original,n,[],true))});
test('audit records before and after without changing original',()=>{const audit=planAssignmentAudit(original,{maxScore:20},'synthetic-teacher',123);assert.equal(audit.before.maxScore,10);assert.equal(audit.after.maxScore,20);assert.equal(original.maxScore,10);assert.equal(planAssignmentAudit(original,{},'synthetic-teacher',123),null)});
