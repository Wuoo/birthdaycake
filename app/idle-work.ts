// Defer optional work beyond entrance animations and cancel it on teardown.
export function scheduleIdleWork(work:()=>void, delay=0){
 let cancelled=false,idle:number|undefined;
 const timer=window.setTimeout(()=>{
  if(cancelled)return;
  if('requestIdleCallback' in window)idle=window.requestIdleCallback(()=>{if(!cancelled)work();},{timeout:4000});
  else work();
 },delay);
 return ()=>{cancelled=true;window.clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback(idle);};
}
