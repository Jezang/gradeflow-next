import type {DocumentReference} from 'firebase-admin/firestore';
import {studentAdminServices} from './student-admin-sdk';
import {verifyLinkedStudentIdentity,withStudentCredentialOperation} from './student-credential-server';
import {accountFirestoreBackend} from './student-account-firestore-adapter';
export function studentAccountServer(){
 const {auth,db}=studentAdminServices();
 const backend=accountFirestoreBackend({
 doc:path=>db.doc(path),
 runTransaction:run=>db.runTransaction(tx=>run({
 get:ref=>tx.get(ref as DocumentReference),
 set:(ref,data)=>tx.set(ref as DocumentReference,data)
 }))
 },auth,(uid,studentId,active)=>verifyLinkedStudentIdentity(auth,db,uid,studentId,active),
 async()=> (await db.doc('portalConfig/student').get()).data()?.enabled===true);
 return {...backend,withOperation:<T>(studentId:string,run:()=>Promise<T>)=>withStudentCredentialOperation(db,studentId,run)};
}
