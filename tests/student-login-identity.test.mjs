import test from 'node:test';
import assert from 'node:assert/strict';
import {studentLoginAlias,validStudentPassword} from '../lib/student-login-identity.ts';
test('student number aliases preserve leading zeros',()=>{assert.notEqual(studentLoginAlias('00123'),studentLoginAlias('123'));assert.throws(()=>studentLoginAlias('a@b.com'))});
test('student number cannot be permanent password',()=>{assert.equal(validStudentPassword('1234567890','1234567890'),false);assert.equal(validStudentPassword('12345','Synthetic!42'),true)});
