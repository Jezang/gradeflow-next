import {NextResponse} from 'next/server';
import {sessionKey,sealLine,openLine,validCredentials} from '../../../../lib/line-session';
import {cookies} from 'next/headers';
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
  const jar=await cookies(),key=sessionKey(),cookieName='gradeflow_line_session';
  const raw=await req.text();if(raw.length>20000)return NextResponse.json({error:'ข้อมูลยาวเกินกำหนด'},{status:413});
  const body=JSON.parse(raw);
  const stored=key?openLine(key,uid,jar.get(cookieName)?.value||''):null;
  if(body.action==='status')return NextResponse.json({saved:!!stored,to:stored?.to||'',available:!!key});
  if(body.action==='clear'){jar.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/line/push',maxAge:0});return NextResponse.json({ok:true})}
  if(body.action==='save'){
   if(!key)return NextResponse.json({error:'ยังไม่ได้ตั้งค่าคีย์บน Vercel'},{status:503});
   if(!validCredentials(body.token,body.to))return NextResponse.json({error:'ตรวจสอบ Token และ LINE ID'},{status:400});
   const value=sealLine(key,uid,body.token,body.to);
   if(value.length>3800)return NextResponse.json({error:'Token ยาวเกินขนาด session ใช้ส่งแบบเดิมได้'},{status:400});
   jar.set(cookieName,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/line/push',maxAge:28800});
   return NextResponse.json({ok:true});
  }
  const {token,to}=body.useSaved?stored||{}:body;
  const message=body.message;
  if(typeof token!=='string'||token.length<20||token.length>4096||!/^[-A-Za-z0-9_+/=.]+$/.test(token)||typeof to!=='string'||! /^[UCR][0-9a-fA-F]{32}$/.test(to)||typeof message!=='string'||!message.trim()||message.length>5000)return NextResponse.json({error:'ตรวจสอบ Token, LINE ID และข้อความ'},{status:400});
  // Firestore create-only time buckets enforce one attempted send per UID per 30 seconds.
  const bucket=Math.floor(Date.now()/30000);
  const throttle=await fetch('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/lineRate/'+encodeURIComponent(uid)+'/slots?documentId='+bucket,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({fields:{uid:{stringValue:uid},bucket:{integerValue:String(bucket)}}}),cache:'no-store'});
  if(!throttle.ok)return NextResponse.json({error:'ส่งถี่เกินไป หรือยังไม่ได้อัปเดต Firebase Rules กรุณาลองใหม่ภายหลัง'},{status:429});
  const sent=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({to,messages:[{type:'text',text:message}]}),cache:'no-store'});
  if(!sent.ok)return NextResponse.json({error:'LINE ปฏิเสธข้อความ (HTTP '+sent.status+') ตรวจสอบ Token และสิทธิ์ผู้รับ'},{status:502});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'ส่งข้อความไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ'},{status:500})}
}
