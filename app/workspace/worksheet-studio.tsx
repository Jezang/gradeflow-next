'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {codeBox,type Placement} from '../../lib/worksheet-placement';
import {inspectWord,stampWord} from '../../lib/worksheet-word';
type Label={code:string;name:string;barcode:string;qr:string};
type Source={kind:'pdf'|'word';name:string;bytes:ArrayBuffer;pages:number};
type Preview={url:string;width:number;height:number};
function download(bytes:Uint8Array,name:string,type:string){
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function aspectOf(url:string){
 const image=new Image();image.src=url;await image.decode();return image.naturalWidth/image.naturalHeight;
}
export default function WorksheetStudio({labels}:{labels:Label[]}){
 const [source,setSource]=useState<Source|null>(null),[preview,setPreview]=useState<Preview|null>(null),[page,setPage]=useState(1),[all,setAll]=useState(false),[kind,setKind]=useState<'qr'|'barcode'>('qr');
 const [placement,setPlacement]=useState<Placement>({x:.72,y:.04,width:.20}),[inches,setInches]=useState(1.25),[aspect,setAspect]=useState(1),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const lock=useRef(false),surface=useRef<HTMLDivElement>(null),drag=useRef<{dx:number;dy:number}|null>(null);
 const example=labels[0]?.[kind];
 useEffect(()=>{let active=true;setAspect(1);if(example)void aspectOf(example).then(a=>{if(active)setAspect(a)}).catch(()=>{});return()=>{active=false}},[example]);
 useEffect(()=>{
  setPreview(null);
  if(source?.kind!=='pdf')return;
  let active=true;let dispose:(()=>Promise<void>)|undefined;
  void(async()=>{try{
   const pdfjs=await import('pdfjs-dist');
   pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   if(!active)return;
   const task=pdfjs.getDocument({data:source.bytes.slice(0),isEvalSupported:false});
   dispose=()=>task.destroy();
   const pdf=await task.promise;
   if(!active)return;
   const p=await pdf.getPage(page);
   const natural=p.getViewport({scale:1}),vp=p.getViewport({scale:Math.min(1.5,1000/natural.width,1300/natural.height)});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('สร้างตัวอย่างไม่ได้');
   await p.render({canvasContext:ctx,viewport:vp}).promise;
   if(active)setPreview({url:canvas.toDataURL('image/png'),width:natural.width,height:natural.height});
  }catch{if(active)setStatus('แสดงตัวอย่าง PDF ไม่ได้ กรุณาลองไฟล์อื่นหรือเบราว์เซอร์รุ่นล่าสุด')}})();
  return()=>{active=false;if(dispose)void dispose().catch(()=>{})}
 },[source,page]);
 async function load(file:File){
  if(lock.current)return;
  lock.current=true;setBusy(true);setSource(null);setPreview(null);setPage(1);setAll(false);setStatus('กำลังตรวจไฟล์บนอุปกรณ์…');
  try{
   if(file.size>10*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 10 MB');
   const bytes=await file.arrayBuffer();
   if(/\.pdf$/i.test(file.name)){
    const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.load(bytes);
    const pages=pdf.getPages();
    if(!pages.length||pages.length>20)throw Error('รองรับ PDF 1–20 หน้า');
    if(pages.some(p=>{const crop=p.getCropBox(),media=p.getMediaBox();return p.getRotation().angle%360!==0||crop.x!==0||crop.y!==0||media.x!==0||media.y!==0||crop.width!==media.width||crop.height!==media.height}))throw Error('PDF ที่หมุนหน้าหรือตัดขอบยังไม่รองรับ กรุณาส่งออก PDF แบบหน้าปกติ');
    if(pdf.getForm().getFields().length)throw Error('กรุณาบันทึก PDF แบบไม่เป็นฟอร์มก่อน');
    setSource({kind:'pdf',name:file.name,bytes,pages:pages.length});setStatus('เลือกหน้าและลากโค้ดไปยังพื้นที่ว่าง');
   }else if(/\.docx$/i.test(file.name)){
    await inspectWord(bytes);setSource({kind:'word',name:file.name,bytes,pages:0});setStatus('พบตำแหน่ง {{BARCODE}} ใน Word แล้ว');
   }else throw Error('รองรับ PDF หรือ DOCX เท่านั้น');
  }catch(e){setStatus(e instanceof Error?e.message:'อ่านเอกสารไม่ได้')}
  finally{lock.current=false;setBusy(false)}
 }
 function begin(e:PointerEvent<HTMLImageElement>){
  if(lock.current)return;
  const rect=e.currentTarget.getBoundingClientRect();drag.current={dx:e.clientX-rect.left,dy:e.clientY-rect.top};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
 }
 function move(e:PointerEvent<HTMLImageElement>){
  if(lock.current||!drag.current||!surface.current)return;
  const r=surface.current.getBoundingClientRect();
  setPlacement(p=>({...p,x:Math.max(0,Math.min(1,(e.clientX-r.left-drag.current!.dx)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top-drag.current!.dy)/r.height))}));
 }
 async function generate(){
  if(lock.current||!source||!labels.length||labels.length>60||(source.kind==='pdf'&&(!preview||source.pages*labels.length>300)))return;
  const approved=window.confirm('สร้างสำเนาใบงาน '+labels.length+' คน? ตรวจตำแหน่งโค้ดไม่ให้ทับเนื้อหา และทดลองพิมพ์/สแกนก่อนแจก');
  if(!approved)return;
  lock.current=true;setBusy(true);
  try{
   const selected=[...labels];const prefix=source.name.replace(/\.(pdf|docx)$/i,'').replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,70)||'worksheet';
   if(source.kind==='pdf'){
    const {PDFDocument}=await import('pdf-lib');const input=await PDFDocument.load(source.bytes),output=await PDFDocument.create();
    for(let i=0;i<selected.length;i++){
     const png=await output.embedPng(selected[i][kind]);
     const pages=await output.copyPages(input,input.getPageIndices());
     pages.forEach((p,index)=>{if(all||index===page-1){const {width,height}=p.getSize(),box=codeBox(width,height,png.width/png.height,placement);p.drawImage(png,{x:box.left,y:box.y,width:box.width,height:box.height})}output.addPage(p)});
     setStatus('สร้างใบงาน '+(i+1)+' / '+selected.length);
    }
    download(await output.save(),prefix+'-gradeflow.pdf','application/pdf');
   }else{
    const {default:JSZip}=await import('jszip');const zip=new JSZip();
    for(let i=0;i<selected.length;i++){
     const s=selected[i],url=s[kind];zip.file(prefix+'-'+s.code+'.docx',await stampWord(source.bytes,url,inches,await aspectOf(url)));setStatus('สร้างใบงาน '+(i+1)+' / '+selected.length);
    }
    download(await zip.generateAsync({type:'uint8array'}),prefix+'-gradeflow.zip','application/zip');
   }
   setStatus('สร้างไฟล์ใหม่สำเร็จ '+selected.length+' คน · ไม่แก้ไขต้นฉบับหรือคะแนน');
  }catch(e){setStatus(e instanceof Error?e.message:'สร้างใบงานไม่ได้')}
  finally{lock.current=false;setBusy(false)}
 }
 const box=preview?codeBox(preview.width,preview.height,aspect,placement):null;
 return <section className="panel worksheet-studio"><small>SMART WORKSHEET</small><h2>แทรกบาร์โค้ด / QR ลงในใบงาน</h2><p>เลือกนักเรียนจาก Barcode &amp; QR Studio ด้านบน · เลือกแล้ว {labels.length} คน · ไฟล์ประมวลผลบนอุปกรณ์</p>
 <div className="worksheet-grid"><div className="worksheet-controls">
 <label>ไฟล์ใบงาน PDF หรือ Word (.docx)<input type="file" accept=".pdf,.docx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void load(f)}}/></label>
 <small>Word: พิมพ์ข้อความ &#123;&#123;BARCODE&#125;&#125; เพียงหนึ่งย่อหน้าตรงจุดที่ต้องการ แล้วบันทึก DOCX ก่อนเลือกไฟล์ ถ้าต้องการลากบนหน้าเอกสารให้ส่งออก PDF ก่อน</small>
 <label>ชนิดโค้ด<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value as 'qr'|'barcode')}><option value="qr">QR Code</option><option value="barcode">CODE128</option></select></label>
 {source?.kind==='pdf'&&<><label>หน้าตัวอย่าง<select value={page} disabled={busy} onChange={e=>setPage(Number(e.target.value))}>{Array.from({length:source.pages},(_,i)=><option key={i} value={i+1}>หน้า {i+1}</option>)}</select></label>
 <label className="worksheet-check"><input type="checkbox" checked={all} disabled={busy} onChange={e=>setAll(e.target.checked)}/> แทรกทุกหน้า (ตำแหน่งสัมพัทธ์เดียวกัน)</label>
 {([['x','ตำแหน่งแนวนอน',0,100],['y','ตำแหน่งแนวตั้ง',0,100],['width','ขนาดเทียบความกว้างหน้า',8,45]] as const).map(([key,label,min,max])=><label key={key}>{label} · {Math.round(placement[key]*100)}%<input type="range" min={min} max={max} value={Math.round(placement[key]*100)} disabled={busy} onChange={e=>setPlacement(p=>({...p,[key]:Number(e.target.value)/100}))}/></label>)}</>}
 {source?.kind==='word'&&<label>ความกว้างโค้ด {inches} นิ้ว<input type="range" min=".5" max="3.5" step=".25" value={inches} disabled={busy} onChange={e=>setInches(Number(e.target.value))}/></label>}
 <button type="button" className="primary" disabled={busy||!source||!labels.length||labels.length>60||(source.kind==='pdf'&&(!preview||source.pages*labels.length>300))} onClick={()=>void generate()}>{source?.kind==='word'?'สร้าง Word รายคน (ZIP)':'สร้าง PDF พร้อมพิมพ์'}</button>
 <small>สูงสุด 60 คน / ครั้ง · PDF รวมไม่เกิน 300 หน้า · ไม่เขียนทับต้นฉบับ</small>
 <p role="status" aria-live="polite">{status}</p>
 </div><div className="worksheet-preview">
 {preview&&box?<div className="worksheet-page" ref={surface}><img className="worksheet-paper" src={preview.url} alt={'ตัวอย่าง PDF หน้า '+page}/>{example&&<img className="worksheet-code" src={example} alt="ลากเพื่อวางโค้ด" draggable={false} onPointerDown={begin} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} style={{left:box.left/preview.width*100+'%',top:box.top/preview.height*100+'%',width:box.width/preview.width*100+'%',height:box.height/preview.height*100+'%'}}/>}</div>:source?.kind==='word'?<div className="worksheet-placeholder"><strong>Word · ตำแหน่งจากข้อความกำกับ</strong>{example&&<img src={example} alt="ตัวอย่างโค้ด" style={{width:inches*96,maxWidth:'90%'}}/>}<small>ตัวอย่างโค้ดเท่านั้น ไม่ใช่การแสดงหน้า Word จริง</small></div>:<div className="worksheet-placeholder">เลือกไฟล์ PDF เพื่อดูตัวอย่างและลากวางโค้ด</div>}
 </div></div></section>
}
