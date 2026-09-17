import fs from "node:fs/promises";
import WebSocket from "ws";

const tabs=await (await fetch("http://127.0.0.1:9333/json")).json();
const page=tabs.find(tab=>tab.type==="page");
if(!page)throw new Error("No Chrome page target");
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject);});
let id=0;const pending=new Map();
ws.on("message",raw=>{const message=JSON.parse(raw);if(message.id&&pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;pending.set(requestId,m=>m.error?reject(new Error(m.error.message)):resolve(m.result));ws.send(JSON.stringify({id:requestId,method,params}));});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await call("Page.navigate",{url:"http://127.0.0.1:5186/"});
for(let attempt=0;attempt<50;attempt++){
  await wait(2000);
  const state=await call("Runtime.evaluate",{expression:`({loading:!!document.querySelector('.loading-scene'),error:document.querySelector('.scene-error')?.textContent||'',canvas:!!document.querySelector('.scene-stage canvas')})`,returnByValue:true});
  if(state.result?.value?.error)throw new Error(state.result.value.error);
  if(state.result?.value?.canvas&&!state.result.value.loading)break;
  if(attempt===49)throw new Error("Scene did not finish loading in 100 seconds");
}
for(const [cake,file] of [["blueberry","blueberry-site-qa.png"],["redvelvet","redvelvet-site-qa.png"]]){
  await call("Runtime.evaluate",{expression:`document.querySelector('#cake-${cake}')?.click()`});await wait(5000);
  const shot=await call("Page.captureScreenshot",{format:"png"});await fs.writeFile(new URL(`../outputs/${file}`,import.meta.url),Buffer.from(shot.data,"base64"));
}
ws.close();
