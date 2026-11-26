import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSchoolRows,previewSchoolRows,sameRecord,template,exportSchoolRows,IMPORT_LIMIT} from '../lib/school-import-export.ts';
test('all four templates validate',()=>{for(const kind of ['students','rooms','subjects','terms'])assert.equal(validateSchoolRows(template(kind)).errors.length,0)});
test('reject numeric codes, duplicates, unexpected columns, invalid status and large input',()=>{
 for(const rows of [[['code','name'],[123,'A']],[['code','name'],['001','A'],['001','B']],[['code','name'],['001','A','extra']],[['code','name','active'],['001','A','maybe']]])assert.ok(validateSchoolRows(rows).errors.length);
 assert.throws(()=>validateSchoolRows([['code','name'],...Array.from({length:IMPORT_LIMIT+1},(_,i)=>[String(i),'A'])]));
});
test('leading zeros, create, rename and no automatic archival/reactivation',()=>{
 const old=[{code:'001',name:'A',active:true},{code:'002',name:'B',active:false}];
 const parsed=validateSchoolRows([['code','name','active'],['001','New','true'],['002','B','true'],['003','C','true'],['004','D','false']]);
 assert.equal(parsed.valid[0].code,'001');assert.deepEqual(previewSchoolRows(parsed.valid,old).map(r=>r.action),['rename','blocked','new','blocked']);
 assert.equal(sameRecord(old[0],{...old[0],name:'Changed'}),false);assert.equal(sameRecord(undefined,undefined),true);
 assert.equal(validateSchoolRows(exportSchoolRows(old)).errors.length,0);
});
