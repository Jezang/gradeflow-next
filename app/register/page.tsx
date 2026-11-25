'use client';
import {useState,useEffect,type FormEvent} from 'react';
import {onAuthStateChanged,createUserWithEmailAndPassword,sendEmailVerification,signOut,type User} from 'firebase/auth';
import {doc,getDoc,serverTimestamp,setDoc} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import Link from 'next/link';
export default function Register(){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseServices().auth,u=>{setUser(u);setReady(true)}),[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{const {auth,db}=firebaseServices();let u=auth.currentUser;if(!u){u=(await createUserWithEmailAndPassword(auth,email.trim(),password)).user;setPassword('');}
 if(!u.emailVerified){await sendEmailVerification(u);setStatus('ส่งอีเมลยืนยันแล้ว กรุณายืนยันอีเมล จากนั้นกดส่งคำขออีกครั้ง');return;}
 await u.getIdToken(true);
 const ref=doc(db,'teacherRequests',u.uid);const profile=await getDoc(doc(db,'profiles',u.uid));if(profile.exists()){setStatus('บัญชีนี้มีโปรไฟล์แล้ว กรุณาเข้าสู่ระบบ');return;}
 const old=await getDoc(ref);if(old.exists()){setStatus('มีคำขอแล้ว: '+old.data().status);return;}
 await setDoc(ref,{name:name.trim(),email:u.email,status:'pending',createdAt:serverTimestamp()});setStatus('ส่งคำขอแล้ว กรุณารอเจ้าของระบบอนุมัติ');
 }catch{setStatus('ดำเนินการไม่สำเร็จ กรุณาตรวจสอบบัญชีหรือกลับไปเข้าสู่ระบบแล้วลองใหม่')}finally{setBusy(false)}}
 async function refresh(){try{await firebaseServices().auth.currentUser?.reload();setUser(firebaseServices().auth.currentUser);setStatus('ตรวจสอบอีเมลแล้ว กรุณากดส่งคำขอ')}catch{setStatus('ตรวจสอบไม่สำเร็จ')}}
 return <main className="panel login" style={{margin:'32px auto',maxWidth:480}}><h1>🌸 ลงทะเบียนคุณครู</h1><p>สมัครบัญชี ยืนยันอีเมล และรอเจ้าของระบบอนุมัติ ก่อนเข้าถึงพื้นที่ทำงาน</p><form onSubmit={submit} style={{display:'grid',gap:12}}><label>ชื่อ-นามสกุล<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>{user?<p>{user.email}</p>:<><label>อีเมล<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>รหัสผ่าน<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label></>}<button className="primary" disabled={!ready||busy}>ส่งคำขอลงทะเบียน</button></form>{user&&<><button disabled={busy} onClick={refresh}>ยืนยันอีเมลแล้ว / ตรวจสอบอีกครั้ง</button><button onClick={()=>signOut(firebaseServices().auth).catch(()=>setStatus('ออกจากระบบไม่สำเร็จ'))}>ออกจากระบบ</button></>}<p role="status">{status}</p><Link href="/login">กลับหน้าเข้าสู่ระบบ</Link></main>
}
