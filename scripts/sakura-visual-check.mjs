// Run with Node 22+ while the LOCAL dev server is running.
// No npm dependencies, browser download, Firebase authentication or writes.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const base=new URL(process.env.SAKURA_PREVIEW_URL||'http://127.0.0.1:3000');
if(base.protocol!=='http:'||!['localhost','127.0.0.1'].includes(base.hostname)||base.username||base.password)throw Error('Only a loopback HTTP preview is allowed');
const chrome=[process.env.CHROME_BIN,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
if(!chrome)throw Error('Chrome/Chromium not found. Set CHROME_BIN to an existing executable.');
const profile=await mkdtemp(join(tmpdir(),'sakura-browser-'));
const output=await mkdtemp(join(tmpdir(),'sakura-visual-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child,ws;
const results=[],errors=[];
let serial=0;
const pending=new Map();
async function waitFor(fn,label,timeout=60000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){if(await fn())return;await sleep(200)}
 throw Error('Timed out: '+label);
}
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++serial;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},30000);
  pending.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error('Browser evaluation failed');
 return r.result.value;
}
const has=selector=>evaluate('Boolean(document.querySelector('+JSON.stringify(selector)+'))');
async function clickText(selector,label){
 const ok=await evaluate('(()=>{const e=[...document.querySelectorAll('+JSON.stringify(selector)+')].find(e=>e.getClientRects().length&&e.textContent.trim()=== '+JSON.stringify(label)+');if(!e)return false;e.click();return true})()');
 if(!ok)throw Error('Visible control not found: '+label);
}
async function view(label,selector){
 await clickText(innerWidthForNav<=850?'nav.hub-bottom-nav button':'aside nav button',label);
 await waitFor(()=>has(selector),label);
}
let innerWidthForNav=1280;
async function capture(width,name){
 await evaluate('window.scrollTo(0,0)');
 await sleep(180);
 const info=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heading:document.querySelector("h1")?.textContent||""})');
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 await writeFile(join(output,width+'-'+name+'.png'),Buffer.from(screenshot.data,'base64'));
 results.push({width,name,pass:info.scrollWidth<=info.width+1,...info});
}
async function resize(width){
 innerWidthForNav=width;
 await send('Emulation.setDeviceMetricsOverride',{width,height:width<=550?844:900,deviceScaleFactor:1,mobile:false});
}
async function load(path,selector){
 await send('Page.navigate',{url:new URL(path,base).href});
 await waitFor(()=>evaluate('document.readyState==="complete"'),path);
 await waitFor(()=>has(selector),selector);
 await sleep(300);
}
try{
 child=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-extensions','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+profile,'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'],{stdio:'ignore'});
 child.on('error',e=>errors.push(e.message));
 const portFile=join(profile,'DevToolsActivePort');
 await waitFor(()=>existsSync(portFile),'Chrome startup',20000);
 const port=(await readFile(portFile,'utf8')).split('\n')[0];
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 const tab=tabs.find(t=>t.type==='page');
 if(!tab)throw Error('No browser tab');
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);return}
  if(m.method==='Fetch.requestPaused'){
   const {requestId,request}=m.params;
   let allowed=false;try{allowed=new URL(request.url).origin===base.origin||/^(data:|blob:)/.test(request.url)}catch{}
   send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(e.message));
  }
  if(m.method==='Runtime.exceptionThrown')errors.push('Browser exception: '+(m.params.exceptionDetails.text||'unknown'));
 });
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const width of [1440,1280,800,768,390,320]){
  await resize(width);
  await load('/','.home-scenic-hero');await capture(width,'home');
  await load('/demo','.hub-kpis');await capture(width,'dashboard');
  await view('อันดับผลงาน','.hub-podium').catch(async e=>{if(width>850)throw e;await view('อันดับ','.hub-podium')});
  await capture(width,'champions');
  await view('ตรวจงาน','.demo-gradebook');await capture(width,'gradebook');
  const navVisible=await evaluate('Boolean(document.querySelector(".hub-bottom-nav").getClientRects().length)');
  results.push({width,name:'mobile navigation breakpoint',pass:navVisible===(width<=850)});
  // Settings remains reachable through the full menu, never via a privileged shortcut.
  if(width<=850)await evaluate('document.querySelector(".hub-menu-toggle").click()');
  await clickText('aside nav button','ตั้งค่า');await waitFor(()=>has('.demo-theme-options'),'settings');
  await capture(width,'settings');
  await evaluate('document.querySelector(".theme-night").click()');
  await waitFor(()=>has('.teacher-hub.night'),'night theme');
  await capture(width,'night-settings');
  await view('ภาพรวม','.hub-kpis');await capture(width,'night-dashboard');
  if(width===390){
   await view('ตรวจงาน','.demo-gradebook');
   await clickText('.score-row-actions button','แก้คะแนน');
   await waitFor(()=>has('.score-inline-edit input'),'score editor');
   const setInput=value=>evaluate('(()=>{const e=document.querySelector(".score-inline-edit input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
   await setInput('11');await clickText('.score-inline-edit button','บันทึก');
   await waitFor(()=>evaluate('document.querySelector(".demo-gradebook [role=status]").textContent.includes("0–10")'),'invalid score rejected');
   await setInput('0');await clickText('.score-inline-edit button','บันทึก');
   await waitFor(()=>evaluate('!document.querySelector(".score-inline-edit")&&document.querySelector(".demo-gradebook tbody tr").textContent.includes("0 / 10")'),'zero score saved');
   results.push({width,name:'invalid score rejected and zero retained (synthetic)',pass:true});
  }
 }
 // Public auth screens only; fresh isolated profile and external requests blocked.
 await resize(1280);await load('/login','.sakura-form');await capture(1280,'login');
 await load('/register','.sakura-form');await capture(1280,'register');
 await resize(390);await capture(390,'register');
 await load('/login','.sakura-form');await capture(390,'login');
}catch(e){errors.push(e.message)}
finally{
 if(ws)ws.close();
 if(child){child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(1500)])}
 await rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
 await writeFile(join(output,'result.json'),JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({output,passed:results.filter(r=>r.pass).length,total:results.length,errors},null,2));
 if(!results.length||results.some(r=>!r.pass)||errors.length)process.exitCode=1;
}
