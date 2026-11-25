'use client';
import {useState,useEffect} from 'react';
import {GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,type User} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
export default function Login(){
const [user,setUser]=useState<User|null>(null),[status,setStatus]=useState('กำลังตรวจสอบบัญชี…'),[busy,setBusy]=useState(true);
useEffect(()=>{let active=true;let seq=0;const {auth,db}=firebaseServices();const unsub=onAuthStateChanged(auth,async u=>{const id=++seq;if(!active)return;setUser(u);setBusy(true);setStatus(u?'กำลังตรวจสอบสิทธิ์…':'เข้าสู่ระบบด้วยบัญชี Google');try{if(u){const snap=await getDoc(doc(db,'profiles',u.uid));if(active&&id===seq)setStatus(snap.exists()&&snap.data().active===true&&['super_admin','admin','teacher'].includes(snap.data().role)?'บัญชีได้รับอนุญาต: '+snap.data().role+' — พื้นที่ทำงานจริงยังอยู่ระหว่างพัฒนา':'บัญชียังไม่ได้รับอนุญาตจากผู้ดูแล');}}catch{if(active&&id===seq)setStatus('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาติดต่อผู้ดูแล');}finally{if(active&&id===seq)setBusy(false);}},()=>{if(active){setStatus('ไม่สามารถตรวจสอบการเข้าสู่ระบบ');setBusy(false)}});return()=>{active=false;unsub()};},[]);
async function enter(){setBusy(true);try{await signInWithPopup(firebaseServices().auth,new GoogleAuthProvider());}catch{setStatus('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Google Login และโดเมน');setBusy(false);}}
async function exit(){try{await signOut(firebaseServices().auth)}catch{setStatus('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่')}}
return <main style={{minHeight:'100vh',display:'grid',placeItems:'center'}}><section className="panel login" style={{width:'100%'}}><div className="mascot" aria-hidden="true">🌸🐱🍃</div><h1>GradeFlow Next</h1><p>เข้าสู่สวนซากุระของคุณครู</p><p role="status">{status}</p>{user?<><p>{user.email}</p><button onClick={exit}>ออกจากระบบ</button></>:<button className="primary" disabled={busy} onClick={enter}>เข้าสู่ระบบด้วย Google</button>}<small>บัญชีใหม่ต้องได้รับอนุญาตจากผู้ดูแลก่อน · ยังไม่เปิดใช้ข้อมูลนักเรียน</small><a href="/">กลับไปยัง Dashboard ตัวอย่าง</a></section></main>
}