import type {DocumentReference} from 'firebase-admin/firestore';
import {studentAdminServices} from './student-admin-sdk';
import {accountFirestoreBackend} from './student-account-firestore-adapter';
export function studentAccountServer(){
 const {auth,db}=studentAdminServices();
 return accountFirestoreBackend({
 doc:path=>db.doc(path),
 runTransaction:run=>db.runTransaction(tx=>run({
 get:ref=>tx.get(ref as DocumentReference),
 set:(ref,data)=>tx.set(ref as DocumentReference,data)
 }))
 },auth,async uid=>{
 try{const user=await auth.getUser(uid);return !user.disabled}
 catch(e){if((e as {code?:string}).code==='auth/user-not-found')return false;throw e}
 },async()=> (await db.doc('portalConfig/student').get()).data()?.enabled===true);
}
