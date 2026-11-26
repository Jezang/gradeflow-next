// Accept only ordinary Google Sheets document links; discard tracking and unrelated parameters.
export function normalizeSheetLink(value:string):string|null{
 const input=value.trim();
 if(!input)return null;
 let url:URL;
 try{url=new URL(input)}catch{throw Error('กรุณาใส่ลิงก์ Google Sheets ที่ถูกต้อง')}
 if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.port||url.username||url.password)throw Error('รองรับเฉพาะลิงก์ Google Sheets');
 const match=url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{1,200})(?:\/edit|\/view|\/preview)?\/?$/);
 if(!match)throw Error('กรุณาใช้ลิงก์ของไฟล์ Google Sheets ไม่ใช่ลิงก์เผยแพร่สาธารณะ');
 const gid=url.searchParams.get('gid')??new URLSearchParams(url.hash.slice(1)).get('gid');
 if(gid!==null&&!/^\d{1,15}$/.test(gid))throw Error('รหัสแท็บไม่ถูกต้อง');
 return 'https://docs.google.com/spreadsheets/d/'+match[1]+'/edit'+(gid!==null?'#gid='+gid:'');
}
