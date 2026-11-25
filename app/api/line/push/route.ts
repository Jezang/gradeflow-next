import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const auth=req.headers.get('authorization');
  if(!auth?.startsWith('Bearer ')||auth.length>8192)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
  const project='gradeflow-next';
  const identity=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyBoUzP1DbEYytgib3woPHg1HDeoHrt6vuo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:auth.slice(7)}),cache:'no-store'});
  if(!identity.ok)return NextResponse.json({error:'บัญชีไม่ถูกต้อง'},{status:401});
  const result=await identity.json(),uid=result.users?.[0]?.localId;
  if(typeof uid!=='string'||!uid)return NextResponse.json({error:'บัญชีไม่ถูกต้อง'},{status:401});
  const profile=await fetch('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/profiles/'+encodeURIComponent(uid),{headers:{Authorization:auth},cache:'no-store'});
  if(!profile.ok)return NextResponse.json({error:'ไม่มีสิทธิ์'},{status:403});
  const fields=(await profile.json()).fields;
  if(fields?.active?.booleanValue!==true||!['super_admin','admin','teacher'].includes(fields?.role?.stringValue))return NextResponse.json({error:'ไม่มีสิทธิ์'},{status:403});
  const raw=await req.text();if(raw.length>20000)return NextResponse.json({error:'ข้อมูลยาวเกินกำหนด'},{status:413});
  const {token,to,message}=JSON.parse(raw);
  if(typeof token!=='string'||token.length<20||token.length>4096||!/^[-A-Za-z0-9_+/=.]+$/.test(token)||typeof to!=='string'||! /^[UCR][0-9a-fA-F]{32}$/.test(to)||typeof message!=='string'||!message.trim()||message.length>5000)return NextResponse.json({error:'ตรวจสอบ Token, LINE ID และข้อความ'},{status:400});
  const sent=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({to,messages:[{type:'text',text:message}]}),cache:'no-store'});
  if(!sent.ok)return NextResponse.json({error:'LINE ปฏิเสธข้อความ (HTTP '+sent.status+') ตรวจสอบ Token และสิทธิ์ผู้รับ'},{status:502});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'ส่งข้อความไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ'},{status:500})}
}
