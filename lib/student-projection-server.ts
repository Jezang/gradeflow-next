import type {DocumentReference,Query} from 'firebase-admin/firestore';
import {studentAdminServices} from './student-admin-sdk';
import {projectionFirestoreBackend} from './student-projection-firestore-adapter';
import {readStudentProjectionSource} from './student-projection-source';
import {adminSourceAdapter} from './student-admin-source-adapter';

export function studentProjectionServer(){
 const {auth,db}=studentAdminServices();
 return projectionFirestoreBackend({
  doc:path=>db.doc(path),
  collection:path=>db.collection(path).limit(450),
  runTransaction:run=>db.runTransaction(tx=>run({
   get:ref=>tx.get(ref as DocumentReference),
   list:query=>tx.get(query as Query),
   set:(ref,data)=>tx.set(ref as DocumentReference,data),
   delete:ref=>tx.delete(ref as DocumentReference)
  }))
 },auth,async()=> (await db.doc('portalConfig/student').get()).data()?.enabled===true,
 async (tx,studentId,termId)=>{
  const source=adminSourceAdapter(db,{getDocument:tx.get,getQuery:tx.list});
  return readStudentProjectionSource(source,studentId,termId);
 });
}
