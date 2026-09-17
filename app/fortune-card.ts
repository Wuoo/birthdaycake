import * as THREE from 'three';
import type { Cake } from './scene-engine';
import { REWARDS, type Fortune } from './fortunes';
import { scheduleIdleWork } from './idle-work';

export type { Fortune } from './fortunes';
const W=1080,H=1560;

// One authored drawing supplies the printed image, foil mask and PNG export.
function artwork(cake:Cake){
 const paper=document.createElement('canvas'),foil=document.createElement('canvas');
 paper.width=foil.width=W;paper.height=foil.height=H;
 const c=paper.getContext('2d')!,f=foil.getContext('2d')!;
 const ink=cake==='blueberry'?'#3d5063':cake==='redvelvet'?'#793340':'#65402b';
 c.fillStyle='#f1e8d6';c.fillRect(0,0,W,H);f.fillStyle='#000';f.fillRect(0,0,W,H);
 let seed=1741;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<42000;i++){c.fillStyle=`rgba(99,68,35,${random()*.055})`;c.fillRect(random()*W,random()*H,1+random()*2,1+random()*2);}
 const path=(draw:(ctx:CanvasRenderingContext2D)=>void,width=2,gold=true)=>{
  for(const ctx of gold?[c,f]:[c]){ctx.beginPath();draw(ctx);ctx.strokeStyle=ctx===f?'white':'#a18349';ctx.lineWidth=width;ctx.stroke();}
 };
 path(ctx=>ctx.roundRect(48,48,W-96,H-96,24),3);
 path(ctx=>ctx.roundRect(64,64,W-128,H-128,18),1);
 // Engraved architectural arch frames the botanical illustration.
 path(ctx=>{ctx.moveTo(190,935);ctx.lineTo(190,476);ctx.bezierCurveTo(190,100,890,100,890,476);ctx.lineTo(890,935);},2.2);
 path(ctx=>{ctx.moveTo(210,906);ctx.lineTo(210,476);ctx.bezierCurveTo(210,131,870,131,870,476);ctx.lineTo(870,906);},1);
 c.fillStyle=ink;c.globalAlpha=.055;c.beginPath();c.ellipse(540,550,280,335,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
 const leaf=(x:number,y:number,a:number,length:number)=>{
  const draw=(ctx:CanvasRenderingContext2D)=>{ctx.moveTo(0,0);ctx.bezierCurveTo(-length*.48,-length*.42,-length*.29,-length*.9,0,-length);ctx.bezierCurveTo(length*.34,-length*.72,length*.35,-length*.25,0,0);};
  for(const ctx of [c,f]){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();draw(ctx);if(ctx===c){ctx.fillStyle=ink;ctx.globalAlpha=.75;ctx.fill();ctx.globalAlpha=1;}ctx.strokeStyle=ctx===f?'#fff':'#b09659';ctx.lineWidth=1.6;ctx.stroke();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-length);for(let i=1;i<7;i++){const yy=-length*i/8;ctx.moveTo(0,yy);ctx.lineTo(length*.19,yy-length*.13);ctx.moveTo(0,yy);ctx.lineTo(-length*.19,yy-length*.1);}ctx.lineWidth=.9;ctx.stroke();ctx.restore();}
 };
 for(const side of [-1,1]){
  path(ctx=>{ctx.moveTo(540,910);ctx.bezierCurveTo(540+side*380,780,540+side*290,485,540+side*115,296);},3);
  for(let i=0;i<9;i++){const t=i/8,x=540+side*(105+140*Math.sin(t*2.5)),y=340+t*470;leaf(x,y,side*(.4+t*.95),78+(i%3)*19);leaf(x,y,side*(-1.15-t*.28),68+(i%2)*15);}
 }
 if(cake==='chocolate'){
  for(let k=0;k<3;k++){const x=445+k*91,y=588+(k%2)*90,a=(k-1)*.38;
   for(const ctx of [c,f]){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,-154);ctx.bezierCurveTo(-134,-83,-105,87,0,158);ctx.bezierCurveTo(105,87,134,-83,0,-154);if(ctx===c){const g=ctx.createLinearGradient(-70,0,70,0);g.addColorStop(0,'#43291e');g.addColorStop(.45,'#b77d42');g.addColorStop(1,'#69402b');ctx.fillStyle=g;ctx.fill();}ctx.strokeStyle=ctx===f?'white':'#c8a263';ctx.lineWidth=2.3;ctx.stroke();for(let j=-2;j<=2;j++){ctx.beginPath();ctx.moveTo(0,-149);ctx.bezierCurveTo(j*48,-55,j*45,80,0,153);ctx.stroke();}ctx.restore();}
  }
 }else if(cake==='blueberry'){
  for(let i=0;i<17;i++){const x=540+Math.sin(i*2.4)*(100-i*3.5),y=450+i*18,r=27+(i%3)*5;path(ctx=>{ctx.moveTo(540,410);ctx.quadraticCurveTo(540+(x-540)*.3,y-65,x,y);},1.3);
   const g=c.createRadialGradient(x-9,y-12,2,x,y,r);g.addColorStop(0,'#8192a7');g.addColorStop(.6,'#475970');g.addColorStop(1,'#253445');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();path(ctx=>{ctx.arc(x,y,r,Math.PI*.95,Math.PI*1.8);},1.8);path(ctx=>{for(let j=0;j<=10;j++){const a=j*Math.PI/5,rr=j%2?5:11;ctx.lineTo(x+Math.cos(a)*rr,y-8+Math.sin(a)*rr);}},1.3);
  }
 }else{
  for(let flower=0;flower<3;flower++){const x=540+(flower-1)*94,y=550+(flower%2)*130;
   for(let ring=4;ring>=0;ring--)for(let p=0;p<7;p++){const a=p*Math.PI*2/7+ring*.5,r=ring*15,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;c.save();c.translate(px,py);c.rotate(a);c.fillStyle=['#b9817c','#a65d63','#8b3b4c','#702738','#501d2d'][4-ring];c.beginPath();c.ellipse(0,0,27+ring*6,16+ring*4,0,0,Math.PI*2);c.fill();c.restore();path(ctx=>ctx.ellipse(px,py,27+ring*6,16+ring*4,a,Math.PI,Math.PI*1.9),1.1);}
  }
 }
 // The reading area is deliberately outside the metal mask.
 c.textAlign='center';c.fillStyle='#8d784f';c.font='21px Georgia';c.letterSpacing='5px';c.fillText('A WISH FOR YOU',540,170);
 path(ctx=>{ctx.moveTo(442,1010);ctx.lineTo(520,1010);ctx.moveTo(560,1010);ctx.lineTo(638,1010);ctx.moveTo(540,1002);ctx.lineTo(548,1010);ctx.lineTo(540,1018);ctx.lineTo(532,1010);ctx.closePath();},1.5);
 return {paper,foil};
}

function printFortune(base:HTMLCanvasElement,fortune:Fortune){
 const paper=document.createElement('canvas');paper.width=W;paper.height=H;
 const c=paper.getContext('2d')!;c.drawImage(base,0,0);c.textAlign='center';
 c.fillStyle='#211b17';c.letterSpacing='8px';c.font='600 100px "SimSun","Songti SC",serif';c.fillText(fortune.title,540,1133);
 c.letterSpacing='2px';c.font='46px "Microsoft YaHei",sans-serif';c.fillStyle='#493c31';const lines=fortune.message.split('\n');lines.forEach((line,i)=>c.fillText(line,540,1230+i*60));
 c.fillStyle='#9b896b';c.letterSpacing='4px';c.font='18px Georgia';c.fillText('BIRTHDAY COLLECTION  /  '+fortune.eyebrow,540,1440);
 return paper;
}

export function createFortuneCard(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,host:HTMLElement){
 const group=new THREE.Group(),overlay=new THREE.Scene();scene.add(group);group.visible=false;
 const uniforms={printMap:{value:null as THREE.Texture|null},foilMap:{value:null as THREE.Texture|null},gold:{value:new THREE.Color('#d5ad62')},opacity:{value:1}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,toneMapped:false,side:THREE.DoubleSide,vertexShader:`varying vec2 uvCard;varying vec3 normalCard;varying vec3 eyeCard;void main(){uvCard=uv;vec4 p=modelViewMatrix*vec4(position,1.);normalCard=normalize(normalMatrix*normal);eyeCard=-p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:`
 varying vec2 uvCard;varying vec3 normalCard;varying vec3 eyeCard;uniform sampler2D printMap;uniform sampler2D foilMap;uniform vec3 gold;uniform float opacity;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec2 uv=uvCard;vec2 corner=max(abs(uv-.5)-vec2(.482),0.);if(length(corner)>.018)discard;vec3 paper=texture2D(printMap,uv).rgb;float mask=texture2D(foilMap,uv).r;
 float grain=hash(floor(uv*vec2(1080.,1560.)));vec3 n=normalize(normalCard+vec3((grain-.5)*.065,sin(uv.y*920.)*.018,0.));vec3 v=normalize(eyeCard);
 vec3 light=normalize(vec3(-.38,.55,1.));vec3 halfDir=normalize(light+v);
 float glint=pow(max(dot(n,halfDir),0.),95.);float band=pow(.5+.5*sin(dot(reflect(-v,n),vec3(13.,5.,2.))+uv.x*9.+uv.y*5.+grain*.45),12.);
 vec3 metal=gold*(.16+glint*2.2+band*3.8)+vec3(1.,.91,.65)*pow(band,4.)*1.7;
 float glow=0.;for(int i=0;i<8;i++){float a=float(i)*.785398;glow+=texture2D(foilMap,uv+vec2(cos(a),sin(a))*.0018).r/8.;}
 vec3 color=mix(paper*(.97+grain*.025),metal,mask)+vec3(1.,.73,.30)*glow*pow(band,3.)*.65;gl_FragColor=vec4(color,opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const card=new THREE.Mesh(new THREE.BoxGeometry(.72,1.04,.008),material);group.add(card);
 const flakes=new THREE.InstancedMesh(new THREE.PlaneGeometry(.009,.014),new THREE.MeshBasicMaterial({color:'#efd49b',side:THREE.DoubleSide,transparent:true}),48);overlay.add(flakes);flakes.visible=false;
 const dummy=new THREE.Object3D(),burstOrigin=new THREE.Vector3(),burstRotation=new THREE.Quaternion();let burst=false;
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType}),quadScene=new THREE.Scene(),quadCamera=new THREE.Camera();
 const horizontalTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 const blurredTarget=horizontalTarget.clone();
 const quadVertex='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const blur=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{map:{value:target.texture},step:{value:new THREE.Vector2()}},vertexShader:quadVertex,fragmentShader:`
 uniform sampler2D map;uniform vec2 step;varying vec2 v;
 void main(){vec3 c=texture2D(map,v).rgb*.262708;
 c+=(texture2D(map,v+step).rgb+texture2D(map,v-step).rgb)*.215082;
 c+=(texture2D(map,v+step*2.).rgb+texture2D(map,v-step*2.).rgb)*.118040;
 c+=(texture2D(map,v+step*3.).rgb+texture2D(map,v-step*3.).rgb)*.035524;
 gl_FragColor=vec4(c,1.);}`});
 const composite=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{map:{value:blurredTarget.texture},amount:{value:0}},vertexShader:quadVertex,fragmentShader:`
 uniform sampler2D map;uniform float amount;varying vec2 v;void main(){gl_FragColor=vec4(texture2D(map,v).rgb*(1.-amount*.47),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),composite);quadScene.add(quad);
 let lastBackgroundFrame=-Infinity,closingAt=0,disposed=false;
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 let active=false,time=0,tiltX=0,tiltY=0,goalX=0,goalY=0,hasArt=false;
 const templates=new Map<Cake,{paper:HTMLCanvasElement;foil:THREE.CanvasTexture}>();
 const prints=new Map<string,THREE.CanvasTexture>();
 let cancelWarmup=()=>{};
 function template(cake:Cake){
  let result=templates.get(cake);if(result)return result;
  const base=artwork(cake),foil=new THREE.CanvasTexture(base.foil);
  result={paper:base.paper,foil};templates.set(cake,result);return result;
 }
 function cachedCard(cake:Cake,fortune:Fortune){
  const base=template(cake),key=JSON.stringify([cake,fortune]);let print=prints.get(key);
  if(print){prints.delete(key);prints.set(key,print);}
  else {print=new THREE.CanvasTexture(printFortune(base.paper,fortune));print.colorSpace=THREE.SRGBColorSpace;prints.set(key,print);}
  // Four likely cards plus the previous download remain bounded, not 12 full sets.
  for(const [oldKey,oldPrint] of prints){if(prints.size<=5)break;if(oldPrint===uniforms.printMap.value||oldPrint===print)continue;oldPrint.dispose();prints.delete(oldKey);}
  return {print,foil:base.foil};
 }
 function prepare(cake:Cake){
  cancelWarmup();let index=-1;
  const step=()=>{
   if(disposed)return;
   if(document.hidden||active){cancelWarmup=scheduleIdleWork(step,1500);return;}
   if(index<0){const base=template(cake);renderer.initTexture(base.foil);}
   else {const cached=cachedCard(cake,REWARDS[index]);renderer.initTexture(cached.print);}
   index++;if(index<REWARDS.length)cancelWarmup=scheduleIdleWork(step,300);
  };
  cancelWarmup=scheduleIdleWork(step,3500);
 }
 const start=new THREE.Vector3(2.25,.22,1.35),destination=new THREE.Vector3(),rise=new THREE.Vector3(),qStart=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-.35,0)),qTilt=new THREE.Quaternion(),size=new THREE.Vector2();
 const ease=(v:number)=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
 function render(){
  if(closingAt){uniforms.opacity.value=1-ease((performance.now()-closingAt)/450);if(uniforms.opacity.value<=0){active=false;group.visible=false;closingAt=0;}}
  if(!active||time<1.3){renderer.render(scene,camera);return;}
  renderer.getDrawingBufferSize(size);const resized=target.width!==size.x||target.height!==size.y;
  if(resized){target.setSize(size.x,size.y);horizontalTarget.setSize(Math.max(1,Math.ceil(size.x/2)),Math.max(1,Math.ceil(size.y/2)));blurredTarget.setSize(horizontalTarget.width,horizontalTarget.height);}
  const amount=ease((time-1.3)/1.4)*uniforms.opacity.value,now=performance.now();
  // Background candles stay alive at 30 Hz; the sharp card responds every frame.
  if(resized||time<3||closingAt||now-lastBackgroundFrame>=1000/30){
   renderer.setRenderTarget(target);renderer.render(scene,camera);
   quad.material=blur;blur.uniforms.map.value=target.texture;blur.uniforms.step.value.set(amount*2/size.x,0);
   renderer.setRenderTarget(horizontalTarget);renderer.render(quadScene,quadCamera);
   blur.uniforms.map.value=horizontalTarget.texture;blur.uniforms.step.value.set(0,amount*2/size.y);
   renderer.setRenderTarget(blurredTarget);renderer.render(quadScene,quadCamera);lastBackgroundFrame=now;
  }
  quad.material=composite;composite.uniforms.amount.value=amount;
  renderer.setRenderTarget(null);renderer.render(quadScene,quadCamera);renderer.autoClear=false;renderer.clearDepth();renderer.render(overlay,camera);renderer.autoClear=true;
 }
 return {
  prepare,
  start(cake:Cake,fortune:Fortune){const cached=cachedCard(cake,fortune);uniforms.printMap.value=cached.print;uniforms.foilMap.value=cached.foil;hasArt=true;lastBackgroundFrame=-Infinity;uniforms.gold.value.set(cake==='redvelvet'?'#d6a084':cake==='blueberry'?'#c8bd8c':'#d5ad62');active=true;closingAt=0;uniforms.opacity.value=1;time=0;burst=false;goalX=goalY=tiltX=tiltY=0;scene.add(group);group.visible=true;group.position.copy(start);group.scale.setScalar(.7);},
  update(t:number,dt:number){if(!active)return;if(reduced)t*=5;time=t;const travel=ease((t-1.3)/1.35);group.visible=t>.45;
   rise.copy(start);rise.y+=ease((t-.45)/.85)*1.34;
   // Unproject the actual viewport center, including the scene camera's view offset.
   destination.set(0,.06,0).unproject(camera).sub(camera.position).normalize();const distance=2.4;destination.multiplyScalar(distance).add(camera.position);
   const height=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));const pixels=Math.min(500,host.clientHeight*.67,(host.clientWidth-48)/(.72/1.04));const scale=height*pixels/host.clientHeight/1.04;
   group.position.lerpVectors(rise,destination,travel);group.position.y+=Math.sin(travel*Math.PI)*.14;
   tiltX=THREE.MathUtils.damp(tiltX,goalX,10,dt);tiltY=THREE.MathUtils.damp(tiltY,goalY,10,dt);
   qTilt.setFromEuler(new THREE.Euler(tiltX,tiltY,Math.sin(Math.max(0,t-2.65)*10)*Math.exp(-Math.max(0,t-2.65)*6)*.02));
   group.quaternion.copy(qStart).slerp(camera.quaternion,travel).multiply(qTilt);group.scale.setScalar(THREE.MathUtils.lerp(.7,scale,travel));
   if(t>=1.3&&group.parent!==overlay)overlay.attach(group);
   if(t>=2.25&&!burst){burst=true;burstOrigin.copy(group.position);burstRotation.copy(group.quaternion);}
   const age=t-2.25;flakes.visible=!reduced&&burst&&age<1.9;
   if(flakes.visible){for(let i=0;i<48;i++){const s=(i*.618033)%1,a=(i*.754878)%1,delay=(i%5)*.025,u=Math.max(0,age-delay),edge=new THREE.Vector3(i%3===0?(s-.5)*.72:(i%2?.36:-.36),i%3===0?.52:(s-.5)*1.04,0).multiplyScalar(scale).applyQuaternion(burstRotation);dummy.position.copy(burstOrigin).add(edge);dummy.position.x+=(s-.5)*u*.55;dummy.position.y+=u*(.12+a*.15)-.3*u*u;dummy.position.z+=Math.sin(i)*u*.12;dummy.rotation.set(u*(3+i%4),i+u*4,u*2);dummy.scale.setScalar(Math.max(0,1-u/1.9)*( .6+a));dummy.updateMatrix();flakes.setMatrixAt(i,dummy.matrix);}flakes.instanceMatrix.needsUpdate=true;}
  },
  tilt(x:number,y:number){goalY=(x-.5)*.68;goalX=(.5-y)*.3;},
  close(){closingAt=performance.now();flakes.visible=false;},render,
  capture(){if(!hasArt)return null;const exportRenderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});exportRenderer.setSize(W,H);exportRenderer.outputColorSpace=THREE.SRGBColorSpace;exportRenderer.toneMapping=THREE.AgXToneMapping;const s=new THREE.Scene(),cam=new THREE.OrthographicCamera(-.36,.36,.52,-.52,.01,10);cam.position.z=2;const copy=new THREE.Mesh(new THREE.PlaneGeometry(.72,1.04),material);s.add(copy);const previousOpacity=uniforms.opacity.value;uniforms.opacity.value=1;exportRenderer.render(s,cam);uniforms.opacity.value=previousOpacity;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.getContext('2d')!.drawImage(exportRenderer.domElement,0,0);copy.geometry.dispose();exportRenderer.dispose();exportRenderer.forceContextLoss();return canvas;},
  dispose(){disposed=true;cancelWarmup();group.removeFromParent();card.geometry.dispose();material.dispose();prints.forEach(texture=>texture.dispose());templates.forEach(base=>base.foil.dispose());prints.clear();templates.clear();flakes.geometry.dispose();(flakes.material as THREE.Material).dispose();target.dispose();horizontalTarget.dispose();blurredTarget.dispose();blur.dispose();composite.dispose();quad.geometry.dispose();}
 };
}
