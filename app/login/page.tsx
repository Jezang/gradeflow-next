'use client';
import {useState,useEffect,type FormEvent} from 'react';
import {GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,browserSessionPersistence,type User} from 'firebase/auth';
import {doc,onSnapshot} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import Link from 'next/link';
import {RELEASE_LABEL} from '../../lib/release';
import './sakura.css';

export default function Login(){
 const [user,setUser]=useState<User|null>(null),[role,setRole]=useState<string|null>(null),[status,setStatus]=useState('กำลังตรวจสอบบัญชี…'),[busy,setBusy]=useState(true),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[show,setShow]=useState(false);
 useEffect(()=>{
  let stopProfile:undefined|(()=>void);
  const {auth,db}=firebaseServices();
  const unsub=onAuthStateChanged(auth,u=>{
   stopProfile?.();setUser(u);setRole(null);setPassword('');
   if(!u){setStatus('ยินดีต้อนรับคุณครู');setBusy(false);return;}
   setBusy(true);setStatus('กำลังตรวจสอบสิทธิ์…');
   stopProfile=onSnapshot(doc(db,'profiles',u.uid),{includeMetadataChanges:true},snap=>{
    const p=snap.data();const allowed=!snap.metadata.fromCache&&p?.active===true&&['super_admin','admin','teacher'].includes(p?.role);
    setRole(allowed&&!snap.metadata.fromCache?p?.role:null);setStatus(allowed?'บัญชีได้รับอนุญาตแล้ว':'บัญชียังไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแล');setBusy(false);
   },()=>{setRole(null);setStatus('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองใหม่');setBusy(false);});
  },()=>{setRole(null);setStatus('ไม่สามารถตรวจสอบการเข้าสู่ระบบ');setBusy(false)});
  return()=>{unsub();stopProfile?.();};
 },[]);
 async function enter(method:'email'|'google'){
  setBusy(true);setStatus('กำลังเข้าสู่ระบบ…');
  try{const {auth}=firebaseServices();await setPersistence(auth,remember?browserLocalPersistence:browserSessionPersistence);
   if(method==='google')await signInWithPopup(auth,new GoogleAuthProvider());else await signInWithEmailAndPassword(auth,email.trim(),password);
  }catch{setStatus('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือการตั้งค่าแล้วลองใหม่');setBusy(false);}
 }
 async function reset(){if(!email.trim()||!/^\S+@\S+\.\S+$/.test(email.trim())){setStatus('กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน');return;}setBusy(true);try{await sendPasswordResetEmail(firebaseServices().auth,email.trim());setStatus('หากบัญชีนี้มีอยู่ ระบบจะส่งคำแนะนำสำหรับรีเซ็ตรหัสผ่านไปยังอีเมล');}catch{setStatus('ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');}finally{setBusy(false);}}
 async function exit(){setBusy(true);try{await signOut(firebaseServices().auth)}catch{setStatus('ออกจากระบบไม่สำเร็จ');setBusy(false)}}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();void enter('email');}
 return <main className="sakura-login"><section className="sakura-art" aria-hidden="true"><svg viewBox="0 0 420 300" role="presentation"><path d="M0 260Q90 200 180 250T420 215V300H0" fill="#bedcc9"/><path d="M65 260Q95 155 70 60M85 160Q145 115 175 55M82 125Q35 90 20 40" fill="none" stroke="#9d7767" strokeWidth="13" strokeLinecap="round"/>{[[32,43],[70,55],[111,74],[154,45],[177,70],[44,100],[108,120],[200,42]].map(([x,y],i)=><g key={i} fill={i%2?'#f4b6cc':'#f9d4df'}>{[0,72,144,216,288].map(a=><ellipse key={a} cx={x} cy={y-12} rx="13" ry="18" transform={'rotate('+a+' '+x+' '+y+')'}/>)}<circle cx={x} cy={y} r="5" fill="#f1ce84"/></g>)}<ellipse cx="277" cy="252" rx="65" ry="12" fill="#95bea7"/><path d="M228 196L226 134L260 153Q278 146 296 153L329 134L327 196Q327 242 278 242Q229 242 228 196Z" fill="#fffdfa" stroke="#987b83" strokeWidth="3"/><path d="M237 151L240 169L253 158M318 151L315 169L302 158" fill="#f5bfce"/><circle cx="259" cy="190" r="5" fill="#52645a"/><circle cx="297" cy="190" r="5" fill="#52645a"/><ellipse cx="248" cy="203" rx="9" ry="5" fill="#f3c3d3"/><ellipse cx="308" cy="203" rx="9" ry="5" fill="#f3c3d3"/><path d="M271 201Q278 208 285 201" stroke="#987b83" fill="none" strokeWidth="2"/><rect x="253" y="221" width="51" height="37" rx="6" fill="#f2b8ca" stroke="#987b83" strokeWidth="2"/><path d="M279 225V254" stroke="#fff9f3" strokeWidth="2"/></svg><h2>ทุกการส่งงาน<br/>คือการเติบโต 🌸</h2><p>พื้นที่ตรวจงานแสนอบอุ่นสำหรับคุณครู</p></section><section className="sakura-form"><small>SAKURA CLASSROOM · {RELEASE_LABEL}</small><h1>GradeFlow Next</h1><p>ยินดีต้อนรับเข้าสู่ระบบตรวจงาน</p><p className="login-status" role="status">{status}</p>{user?<><p>{user.email}</p>{role&&<p className="role-chip">{role==='super_admin'?'เจ้าของระบบ':role==='admin'?'ผู้ดูแลระบบ':'ครูผู้สอน'}</p>}{role?<Link href="/workspace">เข้าสู่พื้นที่ทำงาน →</Link>:<Link href="/register">ลงทะเบียน / ส่งคำขอเป็นครู</Link>}<button disabled={busy} onClick={exit}>ออกจากระบบ</button></>:<form onSubmit={submit}><label>อีเมล<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>รหัสผ่าน<input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button type="button" className="quiet" onClick={()=>setShow(!show)}>{show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'}</button><div className="login-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> จดจำฉัน</label><button type="button" className="quiet" disabled={busy} onClick={reset}>ลืมรหัสผ่าน?</button></div><button className="primary" disabled={busy} type="submit">เข้าสู่ระบบ</button><span className="login-divider">หรือ</span><button type="button" disabled={busy} onClick={()=>enter('google')}>เข้าสู่ระบบด้วย Google</button></form>}<Link href="/register">ลงทะเบียนคุณครู</Link><small>บัญชีต้องได้รับอนุญาตจากผู้ดูแลระบบ</small><Link href="/demo">ดู Dashboard ข้อมูลจำลอง</Link></section></main>
}