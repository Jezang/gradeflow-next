'use client';
import {useEffect,useRef,useState} from 'react';
export default function Camera({onCode}:{onCode:(code:string)=>void}){
 const video=useRef<HTMLVideoElement>(null),callback=useRef(onCode),[status,setStatus]=useState('กำลังเปิดกล้อง…');
 useEffect(()=>{callback.current=onCode},[onCode]);
 useEffect(()=>{let closed=false,done=false;let controls:{stop:()=>void}|undefined;const el=video.current;
 async function start(){try{const {BrowserMultiFormatReader}=await import('@zxing/browser');if(closed||!el)return;const reader=new BrowserMultiFormatReader();controls=await reader.decodeFromVideoDevice(undefined,el,(result,_err,ctl)=>{if(closed||done||!result)return;done=true;ctl.stop();callback.current(result.getText())});if(closed||done)controls.stop();else setStatus('เล็งกล้องไปที่รหัสนักเรียน')}catch{if(!closed)setStatus('เปิดกล้องไม่ได้ ตรวจสอบสิทธิ์กล้อง หรือใช้ USB/พิมพ์รหัสแทน')}}void start();
 return()=>{closed=true;controls?.stop();const stream=el?.srcObject;if(stream instanceof MediaStream)stream.getTracks().forEach(t=>t.stop())}},[]);
 return <div><video ref={video} muted playsInline autoPlay style={{width:'100%',maxWidth:420,borderRadius:14}}/><p role="status">{status}</p><small>อ่านรหัสบนอุปกรณ์ ไม่ส่งภาพกล้องไปยัง Firebase</small></div>
}
