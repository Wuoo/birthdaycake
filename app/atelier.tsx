"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { SceneAPI, Settings, Cake } from "./scene-engine";

import { THEMES } from './table-themes';

import { REWARDS, type Fortune as Reward } from './fortunes';
type MotionPermission="idle"|"requesting"|"active"|"denied"|"unsupported";
type PermissionOrientationEvent=typeof DeviceOrientationEvent&{requestPermission?:()=>Promise<"granted"|"denied">};
const INITIAL:Settings={cake:"chocolate",table:"walnut",decor:"flowers",candles:5,lit:false,ambient:false};
const PREFERENCES_KEY="birthday-preferences-v3";
const CAKES:Cake[]=["chocolate","blueberry","redvelvet"];
const CAKE_INFO:Record<Cake,{name:string;short:string;edition:string}>={
 chocolate:{name:"午夜巧克力",short:"巧克力",edition:"01 / MIDNIGHT CHOCOLATE"},
 blueberry:{name:"蓝莓星轨",short:"蓝莓",edition:"02 / BLUEBERRY CONSTELLATION"},
 redvelvet:{name:"经典红丝绒",short:"红丝绒",edition:"03 / CLASSIC RED VELVET"}
};
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export default function Atelier(){
 const [settings,setSettings]=useState<Settings>(INITIAL);
 const [candleDraft,setCandleDraft]=useState(String(INITIAL.candles));
 const settingsRef=useRef(settings);settingsRef.current=settings;
 const [ready,setReady]=useState(false),[progress,setProgress]=useState(0),[sceneError,setSceneError]=useState("");
 const [preferencesLoaded,setPreferencesLoaded]=useState(false);
 const [retry,setRetry]=useState(0),[panel,setPanel]=useState(false),[cinema,setCinema]=useState(false);
 const [notice,setNotice]=useState("");
 const [reward,setReward]=useState<Reward|null>(null),[rewardVisible,setRewardVisible]=useState(false);
 const [savedReward,setSavedReward]=useState<{reward:Reward;cake:Cake}|null>(null);
 const [motionPermission,setMotionPermission]=useState<MotionPermission>("idle");
 const [blackout,setBlackout]=useState(true);
 const [pendingCake,setPendingCake]=useState<Cake|null>(null),[cakeChanging,setCakeChanging]=useState(false);
 const stage=useRef<HTMLDivElement>(null),api=useRef<SceneAPI|null>(null);
 const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),rewardTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const rewardOpen=useRef(false),lastReward=useRef(-1),restorePanel=useRef(true),rewardCardRef=useRef<HTMLDivElement>(null);
 const rewardDrag=useRef<{pointerId:number;startX:number}|null>(null);
 const motionFrame=useRef(0),motionBaseline=useRef<{beta:number;gamma:number}|null>(null),motionSmooth=useRef({x:.5,y:.46});
 const music=useRef<Partial<Record<Cake,HTMLAudioElement>>>({}),musicFrame=useRef(0),musicGeneration=useRef(0);
 const cakeGeneration=useRef(0),cakeTransitioning=useRef(false),restoreAmbient=useRef(true);
 const ignitionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const flash=useCallback((s:string)=>{setNotice(s);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(""),4500);},[]);
 const applyRewardLighting=useCallback((x:number,y:number,drag=0)=>{
   api.current?.tiltReward(x+drag*.15,y);const card=rewardCardRef.current;if(!card)return;const safeX=Math.max(0,Math.min(1,x)),safeY=Math.max(0,Math.min(1,y)),side=(safeX-.5)*2;
   card.style.setProperty('--drag-x',`${drag*11}px`);card.style.setProperty('--card-rx',`${(.5-safeY)*7}deg`);card.style.setProperty('--card-ry',`${side*14+drag*5}deg`);card.style.setProperty('--glow-x',`${safeX*100}%`);card.style.setProperty('--glow-y',`${safeY*100}%`);card.style.setProperty('--foil-angle',`${102+side*38}deg`);card.style.setProperty('--foil-shift',`${side*76}%`);card.style.setProperty('--flare-opacity',`${.28+Math.abs(side)*.66}`);
 },[]);
 const update=useCallback((patch:Partial<Settings>)=>{if(patch.candles!==undefined)setCandleDraft(String(patch.candles));setSettings(s=>{const next={...s,...patch};settingsRef.current=next;return next;});},[]);
 const fadeMusic=useCallback((cake:Cake|null,restart=false)=>{
   const generation=++musicGeneration.current,target=cake?music.current[cake]:undefined;
   if(target){if(restart)target.currentTime=0;void target.play().catch(()=>{});}
   cancelAnimationFrame(musicFrame.current);
   const start=performance.now(),duration=760;
   const starts=new Map<HTMLAudioElement,number>();Object.values(music.current).forEach(a=>{if(a)starts.set(a,a.volume);});
   const tick=(now:number)=>{if(generation!==musicGeneration.current)return;const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
     starts.forEach((from,a)=>{const to=a===target?.24:0;a.volume=from+(to-from)*ease;});
     if(t<1)musicFrame.current=requestAnimationFrame(tick);else starts.forEach((_,a)=>{if(a!==target){a.pause();a.volume=0;}});
   };musicFrame.current=requestAnimationFrame(tick);
 },[]);
 const changeCake=useCallback(async(next:Cake)=>{
   if(next===settingsRef.current.cake&&!cakeTransitioning.current)return;
   const generation=++cakeGeneration.current;
   if(ignitionTimer.current)clearTimeout(ignitionTimer.current);
   if(!cakeTransitioning.current)restoreAmbient.current=settingsRef.current.ambient;
   cakeTransitioning.current=true;setCakeChanging(true);setPendingCake(next);
   const target=music.current[next];
   if(target){target.volume=0;target.currentTime=0;void target.play().catch(()=>{});}
   fadeMusic(null);update({ambient:false});setBlackout(true);
   try{await Promise.all([wait(900),api.current?.prepareCake(next)]);}catch{if(generation!==cakeGeneration.current)return;setBlackout(false);update({ambient:restoreAmbient.current});cakeTransitioning.current=false;setCakeChanging(false);setPendingCake(null);flash('这款蛋糕暂时未能加载，请重试。');return;}
   if(generation!==cakeGeneration.current)return;
   update({cake:next,table:THEMES[next].table,decor:'flowers',lit:false,ambient:false});fadeMusic(next,true);
   await wait(150);if(generation!==cakeGeneration.current)return;
   setBlackout(false);
   ignitionTimer.current=setTimeout(()=>{if(generation===cakeGeneration.current)update({lit:true});},650);

   cakeTransitioning.current=false;setCakeChanging(false);setPendingCake(null);
 },[fadeMusic,update,flash]);
 useEffect(()=>{
   let alive=true;let entranceFrame=0;setReady(false);setBlackout(true);setSceneError("");setProgress(0);
   import("./scene-engine").then(({createScene})=>createScene(stage.current!,{...settingsRef.current,ambient:false},p=>alive&&setProgress(p),s=>alive&&setSceneError(s),()=>showRandomReward()))
    .then(scene=>{if(!alive){scene.dispose();return;}api.current=scene;scene.update({...settingsRef.current,ambient:false,lit:false});setReady(true);entranceFrame=requestAnimationFrame(()=>{if(alive){scene.update({...settingsRef.current,lit:false});setBlackout(false);ignitionTimer.current=setTimeout(()=>{if(alive&&!cakeTransitioning.current)update({lit:true});},650);}});})
    .catch(e=>{console.error(e);if(alive)setSceneError("三维场景未能加载，请重试。");});
   return()=>{alive=false;cancelAnimationFrame(entranceFrame);if(ignitionTimer.current)clearTimeout(ignitionTimer.current);api.current?.dispose();api.current=null;};
 },[retry,update]);
 useEffect(()=>{api.current?.update(settings);},[settings]);
 useEffect(()=>{
   const tracks:Partial<Record<Cake,HTMLAudioElement>>={};
   for(const cake of CAKES){
     const audio=new Audio(THEMES[cake].music.src);audio.loop=true;audio.preload="auto";audio.volume=0;tracks[cake]=audio;
   }
   music.current=tracks;
   const startMusic=()=>{if(!cakeTransitioning.current)fadeMusic(settingsRef.current.cake);};
   // Attempt normal autoplay, then unlock on the first real gesture if blocked.
   const firstGesture=()=>{startMusic();document.removeEventListener('pointerdown',firstGesture);document.removeEventListener('keydown',firstGesture);};
   const startTimer=setTimeout(startMusic,350);
   document.addEventListener('pointerdown',firstGesture);document.addEventListener('keydown',firstGesture);
   return()=>{clearTimeout(startTimer);document.removeEventListener("pointerdown",firstGesture);document.removeEventListener("keydown",firstGesture);cakeGeneration.current++;musicGeneration.current++;cancelAnimationFrame(musicFrame.current);Object.values(tracks).forEach(audio=>{audio?.pause();if(audio)audio.src="";});};
 },[fadeMusic]);
 useEffect(()=>{
   try{const stored=JSON.parse(localStorage.getItem(PREFERENCES_KEY)||"null");
     if(stored&&Number.isInteger(stored.candles)&&stored.candles>=1&&stored.candles<=12)
       {setSettings({...INITIAL,candles:stored.candles});setCandleDraft(String(stored.candles));}
   }catch{}finally{setPreferencesLoaded(true);}
   return()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current);rewardTimers.current.forEach(clearTimeout);};
 },[]);
 useEffect(()=>{if(!preferencesLoaded||cakeChanging)return;try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({candles:settings.candles}));}catch{}},[settings.candles,preferencesLoaded,cakeChanging]);
 useEffect(()=>{
   if(motionPermission!=="active"||!reward)return;
   motionBaseline.current=null;motionSmooth.current={x:.5,y:.46};
   const onOrientation=(event:DeviceOrientationEvent)=>{if(event.beta===null||event.gamma===null||rewardDrag.current)return;
     if(!motionBaseline.current){motionBaseline.current={beta:event.beta,gamma:event.gamma};return;}
     const dx=Math.max(-1,Math.min(1,(event.gamma-motionBaseline.current.gamma)/28)),dy=Math.max(-1,Math.min(1,(event.beta-motionBaseline.current.beta)/28));
     motionSmooth.current.x+=(.5+dx*.46-motionSmooth.current.x)*.18;motionSmooth.current.y+=(.46+dy*.42-motionSmooth.current.y)*.18;
     cancelAnimationFrame(motionFrame.current);motionFrame.current=requestAnimationFrame(()=>applyRewardLighting(motionSmooth.current.x,motionSmooth.current.y));
   };
   window.addEventListener('deviceorientation',onOrientation,{passive:true});
   return()=>{window.removeEventListener('deviceorientation',onOrientation);cancelAnimationFrame(motionFrame.current);motionBaseline.current=null;};
 },[motionPermission,reward,applyRewardLighting]);
 useEffect(()=>{
   const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,opts:unknown)=>Promise<void>}}).modelContext;
   if(!context)return;const controller=new AbortController();
   const tools=[
    {name:"configure_birthday_table",description:"Set cake theme and candle count on the visible birthday table.",inputSchema:{type:"object",properties:{cake:{enum:CAKES},candles:{type:"integer",minimum:1,maximum:12}},additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:unknown)=>{
      const p=input as Partial<Settings>;if(!p||typeof p!=="object"||Object.keys(p).some(k=>!["cake","candles"].includes(k)))throw new Error("Invalid settings");
      if(p.cake!==undefined&&!CAKES.includes(p.cake))throw new Error("Invalid cake");
      if(p.table!==undefined&&!["walnut","marble","linen","oak","travertine"].includes(p.table))throw new Error("Invalid table");
      if(p.decor!==undefined&&!["flowers","gifts","minimal"].includes(p.decor))throw new Error("Invalid decor");
      if(p.candles!==undefined&&(!Number.isInteger(p.candles)||p.candles<1||p.candles>12))throw new Error("Candles must be 1–12");
      const {cake,...rest}=p;if(Object.keys(rest).length)update(rest);if(cake!==undefined)await changeCake(cake);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {...settingsRef.current};
    }},
    {name:"read_birthday_table",description:"Read the current visible cake and candle configuration.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({...settingsRef.current})}
   ];
   tools.forEach(t=>{try{void Promise.resolve(context.registerTool(t,{signal:controller.signal})).catch(()=>{});}catch{}});
   return()=>controller.abort();
 },[changeCake,update]);
 function toggleLit(){
   if(ignitionTimer.current)clearTimeout(ignitionTimer.current);
   if(!ready)return;const lit=!settings.lit;update({lit});
 }
 function createWishCardCanvas(){
   if(!savedReward)return null;
   return api.current?.captureReward()??null;
 }
 function downloadWishCard(){
   const canvas=createWishCardCanvas();if(!canvas){flash("请先打开礼盒，抽取一张心愿卡。");return;}
   const cake=savedReward!.cake;
   const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download=`birthday-wish-${cake}.png`;link.click();flash('心愿卡已保存为 PNG。');
 }
 async function shareBirthday(){
   const shareData={title:`${CAKE_INFO[settingsRef.current.cake].name} · 生日心愿`,text:'为你准备了一张生日桌，来点亮蜡烛、抽取心愿卡。',url:window.location.href};
   try{
     const canvas=createWishCardCanvas();
     if(canvas&&navigator.share&&navigator.canShare){
       const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
       if(blob){const file=new File([blob],'birthday-wish.png',{type:'image/png'});if(navigator.canShare({files:[file]})){await navigator.share({...shareData,files:[file]});return;}}
     }
     if(navigator.share){await navigator.share(shareData);return;}
     await navigator.clipboard.writeText(window.location.href);flash('分享链接已复制。');
   }catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;flash('暂时无法分享，请稍后再试。');}
 }
 function showReward(next:Reward){
   if(rewardOpen.current||cakeTransitioning.current||!api.current)return;
   rewardOpen.current=true;restorePanel.current=panel;setPanel(false);setReward(next);setRewardVisible(false);
   setSavedReward({reward:next,cake:settingsRef.current.cake});
   rewardTimers.current.forEach(clearTimeout);rewardTimers.current=[];api.current?.revealReward(next);
   rewardTimers.current.push(setTimeout(()=>setRewardVisible(true),2700));
 }
 function showRandomReward(){
   if(rewardOpen.current)return;
   const pool=REWARDS.map((_,index)=>index).filter(index=>index!==lastReward.current);
   const values=new Uint32Array(1);crypto.getRandomValues(values);const index=pool[values[0]%pool.length];lastReward.current=index;showReward(REWARDS[index]);
 }
 function closeReward(){
   if(!rewardOpen.current)return;setRewardVisible(false);api.current?.toggleGift();
   rewardTimers.current.forEach(clearTimeout);rewardTimers.current=[];
   rewardTimers.current.push(setTimeout(()=>{setReward(null);rewardOpen.current=false;setPanel(restorePanel.current);},520));
 }
 function startRewardDrag(e:React.PointerEvent<HTMLDivElement>){
   if((e.target as HTMLElement).closest('button'))return;
   rewardDrag.current={pointerId:e.pointerId,startX:e.clientX};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('is-dragging');
 }
 function moveRewardLight(e:React.PointerEvent<HTMLDivElement>){
   const card=rewardCardRef.current,drag=rewardDrag.current;if(!card)return;if(e.pointerType!=="mouse"&&(!drag||drag.pointerId!==e.pointerId))return;
   const box=card.getBoundingClientRect(),x=(e.clientX-box.left)/box.width,y=(e.clientY-box.top)/box.height,amount=drag&&drag.pointerId===e.pointerId?Math.max(-1,Math.min(1,(e.clientX-drag.startX)/(box.width*.55))):0;
   applyRewardLighting(x,y,amount);
 }
 function endRewardDrag(e:React.PointerEvent<HTMLDivElement>){
   const card=rewardCardRef.current,drag=rewardDrag.current;if(!card||!drag||drag.pointerId!==e.pointerId)return;
   rewardDrag.current=null;if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);card.classList.remove('is-dragging');
   // Preserve the chosen angle after releasing the card.
 }
 async function requestMotionPermission(){
   if(!('DeviceOrientationEvent' in window)){setMotionPermission('unsupported');return;}
   setMotionPermission('requesting');
   try{const api=window.DeviceOrientationEvent as PermissionOrientationEvent,result=api.requestPermission?await api.requestPermission():'granted';setMotionPermission(result==='granted'?'active':'denied');}
   catch{setMotionPermission('denied');}
 }
 function disableMotion(){setMotionPermission('idle');applyRewardLighting(.5,.46);}
 useEffect(()=>{if(!reward)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')closeReward();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[reward]);
 return <main className={`atelier ${cinema?"cinema":""} ${reward?"reward-active":""}`} data-theme={settings.cake}>
   <section className="celebration" aria-label="布置生日桌">
    <header><span className="wordmark cake-wordmark">{CAKE_INFO[settings.cake].name}</span><nav><button className="navlink" onClick={()=>setPanel(p=>!p)} aria-expanded={panel}>重选蛋糕</button><button className="icon-button" aria-label={cinema?"退出沉浸模式":"沉浸模式"} onClick={()=>setCinema(c=>!c)}>⛶</button></nav></header>
    <div className="scene-stage" ref={stage} />
    <div className="scene-vignette" /><div aria-hidden="true" className={`scene-blackout ${blackout?"is-dark":""}`} />
    {!ready&&!sceneError?<div className="loading-scene"><span className="loading-orbit" /><p>正在准备你的生日桌</p><span>{Math.round(progress*100)}%</span></div>:null}
    {sceneError?<div className="loading-scene scene-error"><p>{sceneError}</p><button onClick={()=>setRetry(r=>r+1)}>重新加载</button></div>:null}
    <div role="status" aria-live="polite" className={`scene-transition-label ${cakeChanging?"is-visible":""}`}>{cakeChanging?"重新布置中":""}</div>
    {panel?<aside className="config" aria-label="生日桌设置">
     <div className="panel-heading"><span>{CAKE_INFO[settings.cake].name}</span><button className="icon-button" aria-label="收起设置" onClick={()=>setPanel(false)}>−</button></div>
     <div className={`control-section cake-control ${cakeChanging?"is-changing":""}`}><label>蛋糕 <span>{cakeChanging?"重新布置中":"CAKE"}</span></label><RadioGroup value={pendingCake??settings.cake} onValueChange={v=>void changeCake(v as Cake)} className="swatch-row cake-row" aria-label="蛋糕种类">
       {CAKES.map(v=><div className="swatch-option" key={v}><RadioGroupItem className={`swatch cake-${v}`} value={v} id={`cake-${v}`} aria-label={CAKE_INFO[v].name}/><label htmlFor={`cake-${v}`}>{CAKE_INFO[v].short}</label></div>)}
     </RadioGroup></div>
     <div className="control-section"><label htmlFor="candle-count">蜡烛 <span>CANDLES · 1—12</span></label><div className="counter"><button aria-label="减少蜡烛" disabled={settings.candles<=1} onClick={()=>update({candles:settings.candles-1})}>−</button><input id="candle-count" aria-label="蜡烛数量" type="number" inputMode="numeric" min={1} max={12} step={1} value={candleDraft} onChange={e=>{const raw=e.currentTarget.value.slice(0,2);setCandleDraft(raw);const next=Number(raw);if(raw!==""&&Number.isInteger(next)&&next>=1&&next<=12)update({candles:next});}} onBlur={()=>setCandleDraft(String(settings.candles))}/><button aria-label="增加蜡烛" disabled={settings.candles>=12} onClick={()=>update({candles:settings.candles+1})}>+</button></div></div>
     <div className="light-switch"><label htmlFor="ambient">房间顶灯 · {cakeChanging?"正在换景":settings.ambient?"已开启":"已关闭"}</label><Switch id="ambient" checked={settings.ambient} disabled={cakeChanging} onCheckedChange={ambient=>update({ambient})}/></div>
    </aside>:null}
    {reward?<><div className={`fortune-interaction ${rewardVisible?"is-ready":""}`} role="dialog" aria-modal="true" aria-labelledby="reward-title" onKeyDown={e=>{if(e.key!=="Tab")return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}} onClick={e=>{if(e.target===e.currentTarget&&rewardVisible)closeReward();}}>
      <div ref={rewardCardRef} className="fortune-touch" tabIndex={0} aria-label="左右拖动卡片查看烫金反光" onPointerDown={startRewardDrag} onPointerMove={moveRewardLight} onPointerUp={endRewardDrag} onPointerCancel={endRewardDrag} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();applyRewardLighting(e.key==='ArrowLeft'?.15:.85,.46);}}}>
       <h2 id="reward-title" className="sr-only">{reward.title}</h2><p className="sr-only">{reward.message}</p>
      </div>
      <div className="fortune-actions"><div><button autoFocus onClick={downloadWishCard}>下载心愿卡</button></div><button className="reward-motion-button" disabled={motionPermission==='requesting'} onClick={motionPermission==='active'?disableMotion:()=>void requestMotionPermission()}>{motionPermission==='requesting'?'正在请求权限':motionPermission==='active'?'关闭手机动态反光':'启用手机动态反光'}</button>{motionPermission==='denied'||motionPermission==='unsupported'?<p role="status">仍可用手指左右拖动</p>:null}</div>
    </div></>:null}
    <div className="ritual"><button className="ritual-button" disabled={!ready} onClick={toggleLit}><span aria-hidden="true" className={settings.lit?"flame-icon burning":"flame-icon"}/>{settings.lit?"许个愿吧，再吹灭蜡烛":"点亮蜡烛"}</button></div>
    <footer className="scene-footer scene-footer-clean"><div><button onClick={showRandomReward} disabled={!ready||cakeChanging||!!reward}>打开礼盒</button><button onClick={downloadWishCard} disabled={!savedReward}>下载心愿卡</button><button onClick={()=>void shareBirthday()}>分享</button></div></footer>
    {cinema?<button className="exit-cinema" onClick={()=>setCinema(false)}>退出沉浸 ⛶</button>:null}
   </section>
   {notice?<div className="toast-notice" role="status">{notice}</div>:null}
 </main>;
}
