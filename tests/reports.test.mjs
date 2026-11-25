import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStudents,parseCsv,csv,csvCell} from '../lib/reports.ts';
test('preserves leading zeros and rejects duplicates, nontext ids and extra data',()=>{const r=validateStudents([['001','ชื่อ'],['001','ซ้ำ'],[2,'numeric'],['A','ok','unexpected'],['B',''],['C','ชื่อ 2']]);assert.deepEqual(r.valid,[{code:'001',name:'ชื่อ'},{code:'C',name:'ชื่อ 2'}]);assert.equal(r.errors.length,4)});
test('CSV handles BOM, quotes, commas and line breaks',()=>{assert.deepEqual(parseCsv('\uFEFFcode,name\r\n001,"A, B"\r\n002,"a""b\nc"'),[['code','name'],['001','A, B'],['002','a"b\nc']]);assert.throws(()=>parseCsv('a,"bad'));assert.throws(()=>parseCsv('a,"bad"x'));});
test('CSV formula injection protection and numeric values',()=>{assert.equal(csvCell(' =1+1'),"\"' =1+1\"");assert.equal(csvCell(-2),'"-2"');assert.equal(parseCsv(csv([['001','ชื่อ']]))[0][0],'001');});
