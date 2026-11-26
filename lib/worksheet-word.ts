import JSZip from 'jszip';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',REL='http://schemas.openxmlformats.org/package/2006/relationships',CT='http://schemas.openxmlformats.org/package/2006/content-types';
const parse=(xml:string)=>{const d=new DOMParser().parseFromString(xml,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('โครงสร้าง Word ไม่ถูกต้อง');return d};
const serialize=(d:Document)=>new XMLSerializer().serializeToString(d);
async function part(zip:JSZip,name:string){const file=zip.file(name);if(!file)throw Error('ไม่พบส่วนประกอบ Word');return file.async('string')}
function marker(d:Document){
 const body=d.getElementsByTagNameNS(W,'body')[0];if(!body)throw Error('ไม่พบเนื้อหา Word');
 const hits=Array.from(body.getElementsByTagNameNS(W,'p')).filter(p=>Array.from(p.getElementsByTagNameNS(W,'t')).map(t=>t.textContent).join('').trim()==='{{BARCODE}}');
 if(hits.length!==1)throw Error('ใส่ {{BARCODE}} เป็นข้อความเดี่ยวหนึ่งย่อหน้าในเนื้อหา Word (เพียงหนึ่งตำแหน่ง)');
 const p=hits[0];
 if(Array.from(p.children).some(n=>n.namespaceURI!==W||!['pPr','r'].includes(n.localName))||Array.from(p.getElementsByTagNameNS(W,'r')).some(r=>Array.from(r.children).some(n=>n.namespaceURI!==W||!['rPr','t'].includes(n.localName))))throw Error('ใช้ย่อหน้าข้อความธรรมดาสำหรับ {{BARCODE}}');
 return p;
}
export async function inspectWord(bytes:ArrayBuffer){const zip=await JSZip.loadAsync(bytes);marker(parse(await part(zip,'word/document.xml')))}
export async function stampWord(bytes:ArrayBuffer,png:string,widthInches:number,aspect:number){
 if(!Number.isFinite(widthInches)||widthInches<0.5||widthInches>3.5||!Number.isFinite(aspect)||aspect<=0)throw Error('ขนาดโค้ดไม่ถูกต้อง');
 const zip=await JSZip.loadAsync(bytes);
 const d=parse(await part(zip,'word/document.xml')),p=marker(d);
 const rels=parse(await part(zip,'word/_rels/document.xml.rels')),types=parse(await part(zip,'[Content_Types].xml'));
 let i=1;const ids=new Set(Array.from(rels.getElementsByTagNameNS(REL,'Relationship')).map(x=>x.getAttribute('Id')));
 while(ids.has('rIdGradeFlow'+i)||zip.file('word/media/gradeflow-code-'+i+'.png'))i++;
 const id='rIdGradeFlow'+i,media='media/gradeflow-code-'+i+'.png';
 const relationship=rels.createElementNS(REL,'Relationship');
 relationship.setAttribute('Id',id);relationship.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');relationship.setAttribute('Target',media);rels.documentElement.appendChild(relationship);
 if(!Array.from(types.getElementsByTagNameNS(CT,'Default')).some(x=>x.getAttribute('Extension')?.toLowerCase()==='png')){
  const item=types.createElementNS(CT,'Default');item.setAttribute('Extension','png');item.setAttribute('ContentType','image/png');types.documentElement.appendChild(item);
 }
 const cx=Math.round(widthInches*914400),cy=Math.round(cx/aspect);
 const docId=Math.max(0,...Array.from(d.getElementsByTagNameNS(WP,'docPr')).map(x=>Number(x.getAttribute('id'))||0))+1;
 const run=parse('<w:r xmlns:w="'+W+'" xmlns:wp="'+WP+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+docId+'" name="GradeFlow code"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="GradeFlow code.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>');
 for(const child of Array.from(p.childNodes))if(child.nodeType!==1||(child as Element).localName!=='pPr')p.removeChild(child);
 p.appendChild(d.importNode(run.documentElement,true));
 zip.file('word/document.xml',serialize(d));zip.file('word/_rels/document.xml.rels',serialize(rels));zip.file('[Content_Types].xml',serialize(types));
 zip.file('word/'+media,png.split(',')[1],{base64:true});
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
