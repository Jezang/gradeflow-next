import type {ProjectionBackend,ProjectionTransaction} from './student-projection-service';
import type {AccountBinding,AccountOwner} from './student-account-plan';
import type {SourceWork} from './student-projection-plan';
import {authorizeStudentPublisher,type IdentityVerifier} from './student-admin-authorization.ts';
import {validStudentProjectionLabel} from './student-projection-document.ts';

type Row=Record<string,unknown>;
interface Snapshot {exists:boolean;data():Row|undefined}
interface QuerySnapshot {docs:readonly {id:string;data():Row}[]}
interface Tx {get(ref:unknown):Promise<Snapshot>;list(ref:unknown):Promise<QuerySnapshot>;set(ref:unknown,data:object):void;delete(ref:unknown):void}
export interface ProjectionStore {doc(path:string):unknown;collection(path:string):unknown;runTransaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>}

const writeLimit=450;
const projectionPath=(uid:string,termId:string)=>'studentPortalViews/'+uid+'/terms/'+termId;

export function projectionFirestoreBackend(store:ProjectionStore,identity:IdentityVerifier,enabled:()=>Promise<boolean>,readSource:(tx:Tx,sid:string,term:string)=>Promise<{label:string;rows:readonly SourceWork[];complete:boolean}>):ProjectionBackend{
 return {
  enabled,
  authorizePublisher:token=>authorizeStudentPublisher(identity,token),
  transaction:run=>store.runTransaction(async tx=>{
   const read=async(path:string)=>{
    const snapshot=await tx.get(store.doc(path));
    return snapshot.exists?snapshot.data():null;
   };
   const listWorks=async(path:string)=>{
    const snapshot=await tx.list(store.collection(path+'/works'));
    if(snapshot.docs.length>=writeLimit)throw Error('Projection exceeds transaction budget');
    return snapshot.docs;
   };

   let owner:AccountOwner|null=null;
   let current:{path:string;label:string;works:readonly {id:string}[]}|undefined;
   const adapter:ProjectionTransaction={
    readOwner:async studentId=>{
     owner=await read('studentPortalOwners/'+studentId) as AccountOwner|null;
     return owner;
    },
    readBinding:async uid=>await read('studentPortalBindings/'+uid) as AccountBinding|null,
    readSource:async(studentId,termId)=>{
     if(!owner)throw Error('Missing owner');
     const source=await readSource(tx,studentId,termId);
     if(source.complete!==true)throw Error('Incomplete source snapshot');
     if(!validStudentProjectionLabel(source.label))throw Error('Invalid term label');
     const path=projectionPath(owner.uid,termId);
     current={path,label:source.label,works:await listWorks(path)};
     return source.rows;
    },
    replaceWorks:(uid,termId,works)=>{
     if(current?.path!==projectionPath(uid,termId))throw Error('Projection mismatch');
     const {path,label}=current;
     const ids=new Set(works.map(work=>work.id));
     const stale=current.works.filter(old=>!ids.has(old.id));
     if(stale.length+works.length+1>writeLimit)throw Error('Projection exceeds transaction budget');
     tx.set(store.doc(path),{label});
     for(const work of stale)tx.delete(store.doc(path+'/works/'+work.id));
     for(const work of works)tx.set(store.doc(path+'/works/'+work.id),work);
    },
    removeTerm:async(uid,termId)=>{
     if(owner?.uid!==uid)throw Error('Projection mismatch');
     const path=projectionPath(uid,termId);
     const works=await listWorks(path);
     for(const work of works)tx.delete(store.doc(path+'/works/'+work.id));
     tx.delete(store.doc(path));
    }
   };
   return run(adapter);
  })
 };
}
