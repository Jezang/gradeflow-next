import type {ProjectionBackend,ProjectionTransaction} from './student-projection-service';
import type {AccountBinding,AccountOwner} from './student-account-plan';
import type {SourceWork} from './student-projection-plan';
import {authorizeStudentPublisher,type IdentityVerifier} from './student-admin-authorization.ts';
interface Snapshot {exists:boolean;data():unknown}
interface QuerySnapshot {docs:readonly {id:string}[]}
interface Tx {get(ref:unknown):Promise<Snapshot>;list(ref:unknown):Promise<QuerySnapshot>;set(ref:unknown,data:object):void;delete(ref:unknown):void}
export interface ProjectionStore {doc(path:string):unknown;collection(path:string):unknown;runTransaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>}
export function projectionFirestoreBackend(store:ProjectionStore,identity:IdentityVerifier,enabled:()=>Promise<boolean>,readSource:(tx:Tx,sid:string,term:string)=>Promise<{label:string;rows:readonly SourceWork[];complete:boolean}>):ProjectionBackend{
 return {enabled,authorizePublisher:token=>authorizeStudentPublisher(identity,token),transaction:run=>store.runTransaction(async tx=>{
 const read=async(path:string)=>{const s=await tx.get(store.doc(path));return s.exists?s.data():null};
 let owner:AccountOwner|null=null,termPath='',label='',old:readonly {id:string}[]=[];
 const adapter:ProjectionTransaction={
 readOwner:async sid=>{owner=await read('studentPortalOwners/'+sid) as AccountOwner|null;return owner},
 readBinding:async uid=>await read('studentPortalBindings/'+uid) as AccountBinding|null,
 readSource:async(sid,term)=>{if(!owner)throw Error('Missing owner');const source=await readSource(tx,sid,term);if(source.complete!==true)throw Error('Incomplete source snapshot');if(!source.label.trim())throw Error('Missing term label');label=source.label;termPath='studentPortalViews/'+owner.uid+'/terms/'+term;old=(await tx.list(store.collection(termPath+'/works'))).docs;return source.rows},
 replaceWorks:(uid,term,works)=>{if(termPath!=='studentPortalViews/'+uid+'/terms/'+term)throw Error('Projection mismatch');const ids=new Set(works.map(w=>w.id));const stale=old.filter(d=>!ids.has(d.id));if(stale.length+works.length+1>450)throw Error('Projection exceeds transaction budget');tx.set(store.doc(termPath),{label});for(const d of stale)tx.delete(store.doc(termPath+'/works/'+d.id));for(const w of works)tx.set(store.doc(termPath+'/works/'+w.id),w)}
 };return run(adapter);
 })};
}
