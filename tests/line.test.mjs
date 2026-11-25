import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sealLine,openLine,sessionKey,validCredentials} from '../lib/line-session.ts';
test('session is encrypted and bound to account and expiry',()=>{const key=sessionKey('ab'.repeat(32)),token='exampleToken012345678901234567',to='U'+'a'.repeat(32),now=1000;const sealed=sealLine(key,'owner',token,to,now);assert.ok(!sealed.includes(token));assert.deepEqual(openLine(key,'owner',sealed,now),{token,to});assert.equal(openLine(key,'other',sealed,now),null);assert.equal(openLine(key,'owner',sealed,now+28800000),null);const bytes=Buffer.from(sealed,'base64url');bytes[30]^=1;assert.equal(openLine(key,'owner',bytes.toString('base64url'),now),null);assert.notEqual(sealLine(key,'owner',token,to,now),sealed)});
test('reject invalid key and credentials',()=>{assert.equal(sessionKey('bad'),null);assert.equal(validCredentials('short','U'+'a'.repeat(32)),false);assert.equal(validCredentials('a'.repeat(40),'invalid'),false)});
