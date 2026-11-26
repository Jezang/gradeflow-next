import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectLegacy,prepareLegacy,matchLegacy,planLegacyGroups,checkLegacyRegistry,planEnglishTerm2} from '../lib/migration.ts';
const example=()=>({students:{'001':{id:'001',name:'Test',level:'M2',room:'5',subject:'ENG',no:'1'},'002':{id:'002',name:'Test 2'}},assignments:{a1:{id:'a1',name:'Work',maxScore:10}},records:{a1:{'001':{score:0,submitted:true,note:'note',ts:123},'002':{score:null,submitted:false,status:'leave'}}},config:{lineToken:'secret-test-value'}});
test('counts valid zero scores and leave separately, never exports config',()=>{const s=inspectLegacy(example());assert.equal(s.students,2);assert.equal(s.records,2);assert.equal(s.sent,1);assert.equal(s.graded,1);assert.equal(s.leave,1);assert.equal(s.notes,1);assert.equal(s.issues.length,0);assert.equal(s.roster[0].code,'001');assert.ok(!JSON.stringify(s).includes('secret-test-value'))});
test('rejects missing structures, invalid score and orphan records',()=>{assert.throws(()=>inspectLegacy({students:{}}));const d=example();d.records.a1['001'].score=11;d.records.a1.unknown={submitted:true,score:1};assert.equal(inspectLegacy(d).issues.length,2)});

test('preserves zero, notes, timestamp and leave; explicit mapping rejects mismatch',()=>{const d=prepareLegacy(example());const a=d.work[0];assert.equal(a.records.find(r=>r.studentId==='001').score,0);assert.equal(a.records.find(r=>r.studentId==='001').originalTs,123);assert.equal(a.records.find(r=>r.studentId==='001').note,'note');assert.equal(a.records.find(r=>r.studentId==='002').status,'leave');const p=matchLegacy(a,d.roster,[{code:'001',name:'Test'}]);assert.equal(p.records.length,1);assert.equal(p.outside,1);assert.equal(p.problems.length,0);assert.equal(matchLegacy(a,d.roster,[{code:'001',name:'Wrong'}]).problems.length,2);});

test('accepts object and serialized payload envelopes with identical preview and preparation',()=>{
 const original=example();
 for(const payload of [original,JSON.stringify(original)]){
  const wrapped={payload,updated_at:'synthetic-time',saved_by:'synthetic-owner',config:{lineToken:'outer-secret'}};
  assert.deepEqual(inspectLegacy(wrapped),inspectLegacy(original));
  assert.deepEqual(prepareLegacy(wrapped),prepareLegacy(original));
  for(const output of [inspectLegacy(wrapped),prepareLegacy(wrapped)]){
   assert.ok(!JSON.stringify(output).includes('secret-test-value'));
   assert.ok(!JSON.stringify(output).includes('outer-secret'));
   assert.ok(!JSON.stringify(output).includes('synthetic-owner'));
  }
 }
});
test('rejects ambiguous, invalid, partial or array payloads without inventing missing records',()=>{
 for(const raw of [
  {...example(),payload:example()},
  {students:{},payload:example()},
  {payload:'{bad json'},
  {payload:null},
  {payload:[]},
  {payload:{students:{},assignments:{}}},
  {payload:{students:[],assignments:{},records:{}}},
  {payload:{payload:example()}},
 ]){
  assert.throws(()=>inspectLegacy(raw));
  assert.throws(()=>prepareLegacy(raw));
 }
});
test('wrapped backup retains score and identity validation',()=>{
 const bad=example();bad.records.a1['001'].score=11;
 assert.equal(inspectLegacy({payload:bad}).issues.length,1);
 assert.throws(()=>prepareLegacy({payload:bad}));
 const empty={students:{},assignments:{},records:{}};
 assert.equal(inspectLegacy({payload:empty}).students,0);
 assert.deepEqual(prepareLegacy({payload:empty}),{roster:[],work:[]});
});

test('plans exact class-room-subject groups without mixing adjacent subjects or levels',()=>{
 const d=example();
 d.students['002']={id:'002',name:'Test 2',level:'M2',room:'5',subject:'ENG2'};
 d.students['003']={id:'003',name:'Test 3',level:'M3',room:'5',subject:'ENG'};
 d.students['004']={id:'004',name:'Test 4',level:'M2',room:'5',subject:'ENG'};
 d.students['005']={id:'005',name:'Test 5',level:'M2',room:'5'};
 d.assignments.a1={id:'a1',name:'Work',maxScore:10,level:'M2',room:'5',subject:'ENG'};
 d.assignments.a2={id:'a2',name:'Matched',maxScore:10,level:'M2',room:'5',subject:'ENG'};
 d.assignments.a3={id:'a3',name:'Incomplete scope',maxScore:10,level:'M3',room:'5'};
 d.records.a2={'001':{submitted:true,score:0}};
 const p=planLegacyGroups(prepareLegacy({payload:d}));
 assert.equal(p.studentCount,5);
 assert.equal(p.rooms,2);assert.equal(p.subjects,2);assert.equal(p.groups.length,3);
 assert.deepEqual(p.incomplete.map(s=>s.code),['005']);
 assert.deepEqual(p.groups.find(g=>g.level==='M2'&&g.subject==='ENG').students.map(s=>s.code),['001','004']);
 assert.equal(p.assignments[0].status,'review-records');assert.equal(p.assignments[0].outside,1);assert.equal(p.assignments[0].groupKey,null);
 assert.equal(p.assignments[1].status,'matched');assert.equal(p.assignments[1].groupKey,JSON.stringify(['M2','5','ENG']));
 assert.equal(p.assignments[2].status,'review-scope');assert.equal(p.assignments[2].candidateCount,1);assert.equal(p.assignments[2].groupKey,null);
});
test('registry verification requires exact code, name and active state',()=>{
 const d=example();
 d.students['003']={id:'003',name:'Test 3'};
 d.students['004']={id:'004',name:'Test 4'};
 assert.deepEqual(checkLegacyRegistry(prepareLegacy(d).roster,[
  {code:'001',name:'Test',active:true},
  {code:'002',name:'Different',active:true},
  {code:'003',name:'Test 3',active:false},
  {code:'999',name:'Unrelated',active:true},
 ]),{matched:1,missing:1,nameMismatch:1,inactive:1});
});

test('term 2 joins explicitly approved aliases while retaining original fields and all record details',()=>{
 const d=example();
 d.students={'001':{id:'001',name:'Test 1',level:'2',room:'4',subject:'ภาษาอังกฤษ 3'},'002':{id:'002',name:'Test 2',level:'2',room:'4',subject:'ถาษาอังกฤษ 3'},'003':{id:'003',name:'Test 3',level:'3',room:'4',subject:'ภาษาอังกฤษ 5'},'004':{id:'004',name:'Test 4',level:'3',room:'4',subject:'ภาษาอังกฤษ 6'}};
 d.assignments.a1.subject='อังกฤษ';
 d.records.a1={'001':{submitted:true,score:0,note:'note',ts:123},'002':{submitted:false,status:'leave'},'003':{submitted:true,score:4}};
 const prepared=prepareLegacy(d),before=JSON.stringify(prepared);
 const p=planEnglishTerm2(prepared);
 assert.equal(p.year,2569);assert.equal(p.term,2);
 assert.equal(p.groups.length,2);assert.equal(p.unresolved.length,0);
 assert.deepEqual(p.groups.map(g=>[g.subject,g.students.length]),[['ภาษาอังกฤษ 4',2],['ภาษาอังกฤษ 6',2]]);
 assert.equal(p.recordCount,3);
 assert.equal(p.assignments[0].scopeNeedsReview,true);
 assert.deepEqual(p.assignments[0].partitions.flatMap(x=>x.records),prepared.work[0].records);
 assert.equal(p.assignments[0].unresolvedRecords.length,0);
 assert.equal(JSON.stringify(prepared),before);
});
test('term 2 blocks unknown subjects and out-of-scope records instead of assigning them to a wrong class',()=>{
 const d=example();
 d.students['001']={id:'001',name:'Test 1',level:'2',room:'4',subject:'ภาษาอังกฤษ 3'};
 d.students['002']={id:'002',name:'Test 2',level:'2',room:'5',subject:'ภาษาอังกฤษ 4'};
 d.students['003']={id:'003',name:'Test 3',level:'3',room:'4',subject:'ภาษาอังกฤษ 4'};
 d.assignments.a1={id:'a1',name:'Work',maxScore:10,level:'2',room:'4',subject:'ภาษาอังกฤษ 3'};
 d.assignments.a2={id:'a2',name:'Unknown',maxScore:10,subject:'Math'};
 d.records.a2={'001':{submitted:true,score:1}};
 const p=planEnglishTerm2(prepareLegacy(d));
 assert.equal(p.unresolved.length,1);
 assert.equal(p.assignments[0].partitions.length,1);
 assert.equal(p.assignments[0].scopeNeedsReview,false);
 assert.equal(p.assignments[0].unresolvedRecords.length,1);
 assert.equal(p.assignments[1].partitions.length,0);
 assert.equal(p.assignments[1].unresolvedRecords.length,1);
 assert.equal(p.assignments[1].scopeNeedsReview,true);
});
