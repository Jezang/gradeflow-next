import {readFileSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDocFromServer,runTransaction,Timestamp} from 'firebase/firestore';
import {backupRows,compareBackup,MAX_BYTES} from '../lib/backup.ts';
function decode(v,depth=0){
 if(depth>40)throw Error('Nested value too deep');
 if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
 if(Array.isArray(v))return v.map(x=>decode(x,depth+1));
 if(!v||typeof v!=='object')throw Error('Unsupported value');
 if(Object.hasOwn(v,'$type')){
  if(v.$type!=='timestamp'||Object.keys(v).length!==3||!Number.isSafeInteger(v.seconds)||!Number.isInteger(v.nanoseconds)||v.nanoseconds<0||v.nanoseconds>=1000000000)throw Error('Invalid timestamp');
  return new Timestamp(v.seconds,v.nanoseconds);
 }
 return Object.fromEntries(Object.entries(v).map(([k,x])=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe key');return [k,decode(x,depth+1)]}));
}
function encode(v){
 if(v instanceof Timestamp)return {$type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};
 if(Array.isArray(v))return v.map(encode);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]));
 return v;
}
export async function rehearse(raw){
 const endpoint=process.env.FIRESTORE_EMULATOR_HOST||'';
 const match=/^(localhost|127\.0\.0\.1):(\d{1,5})$/.exec(endpoint);
 if(!match||Number(match[2])<1||Number(match[2])>65535)throw Error('Refusing recovery: local Firestore emulator required');
 const rows=backupRows(raw);if(!rows.length)throw Error('Empty backup');
 // Decode every record before opening a connection; never use production credentials.
 const prepared=rows.map(row=>({path:row.path,data:decode(row.data)}));
 const projectId='demo-gf-recovery-'+randomUUID().slice(0,8);
 const env=await initializeTestEnvironment({projectId,firestore:{host:match[1],port:Number(match[2]),rules:"rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{path=**} { allow read, write: if false; } } }"}});
 try{
  return await env.withSecurityRulesDisabled(async context=>{
   const db=context.firestore();
   for(const row of prepared){
    const ref=doc(db,row.path);
    await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())throw Error('Destination already exists');tx.set(ref,row.data)});
   }
   const restored=[];
   for(const row of prepared){const snap=await getDocFromServer(doc(db,row.path));if(snap.exists())restored.push({path:row.path,data:encode(snap.data())})}
   const report=compareBackup(rows,restored);
   if(report.equal!==rows.length||report.missing.length||report.changed.length||report.extra.length)throw Error('Recovery verification mismatch');
   return {projectId,verified:report.equal,total:rows.length};
  });
 }finally{await env.cleanup()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const file=process.argv[2];if(!file||statSync(file).size>MAX_BYTES)throw Error('Provide a JSON backup no larger than 10 MB');
 const result=await rehearse(JSON.parse(readFileSync(file,'utf8')));console.log(JSON.stringify(result));}
 catch{console.error('Recovery rehearsal failed. Check file format, emulator and limits. No production writes attempted.');process.exitCode=1}
}
