import { THEMES } from './table-themes';
import { createFortuneCard, type Fortune } from './fortune-card';
import { scheduleIdleWork } from './idle-work';
import { makeBouquet } from './theme-bouquet';
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

export type Cake = "chocolate" | "blueberry" | "redvelvet";
export type Table = "walnut" | "marble" | "linen" | "oak" | "travertine";
export type Decor = "flowers" | "gifts" | "minimal";
export type Settings = { cake: Cake; table: Table; decor: Decor; candles: number; lit: boolean; ambient: boolean };
export type SceneAPI = { toggleGift:()=>void; prepareCake: (cake:Cake) => Promise<void>; update: (s: Settings) => void; reset: () => void; dispose: () => void; blow: () => void; revealReward: (fortune:Fortune) => void; tiltReward:(x:number,y:number)=>void; captureReward:()=>HTMLCanvasElement|null; capture: () => string };
const PUBLIC_BASE=(import.meta.env.BASE_URL||'/').replace(/\/?$/,'/');

// Object-space microstructure survives export even on sculpted meshes without UVs.
function edibleSurface(m: THREE.MeshStandardMaterial, enhanced=false) {
 if(m.normalMap&&!enhanced)return; // Authored food maps already contain the material microstructure.
 const cream=/cream|buttercream|red_velvet_crumb/.test(m.name),berry=/blueberry|raspberry/.test(m.name),chocolate=/ganache|glaze|ribbon/.test(m.name);
 if(!cream&&!berry&&!chocolate)return;
 if(chocolate)return; // Chocolate ships with baked base-color, roughness and normal maps.
 m.bumpMap=null;
 m.onBeforeCompile=shader=>{
  shader.vertexShader="varying vec3 foodPosition;\n"+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nfoodPosition = position;");
  shader.fragmentShader=`
varying vec3 foodPosition;
float foodHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float foodNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(foodHash(i),foodHash(i+vec3(1,0,0)),f.x),mix(foodHash(i+vec3(0,1,0)),foodHash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(foodHash(i+vec3(0,0,1)),foodHash(i+vec3(1,0,1)),f.x),mix(foodHash(i+vec3(0,1,1)),foodHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
float detail=foodNoise(foodPosition*150.);float mottling=foodNoise(foodPosition*24.);
diffuseColor.rgb*=mix(${cream?".96":" .74"},1.04,mottling)*mix(.91,1.05,detail);
${berry?"diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.62,.69,.84),diffuseColor.rgb*1.34,smoothstep(.28,.66,mottling));":""}
`);
  shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
vec3 dpdx=dFdx(vViewPosition),dpdy=dFdy(vViewPosition);
vec3 r1=cross(dpdy,normal),r2=cross(normal,dpdx);
float det=dot(dpdx,r1);
float h=foodNoise(foodPosition*150.)*${cream?".0006":berry?".0007":".00035"};
vec3 gradient=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
normal=normalize(abs(det)*normal-gradient);
`);
 };
 m.customProgramCacheKey=()=>cream?"food-cream-v2":berry?"food-berry-v1":"food-chocolate-v1";
}

const flameVertex = `
varying vec3 vPosition;
void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const flameFragment = `
precision highp float;
varying vec3 vPosition;
uniform vec3 eye;
uniform float time;
uniform float heat;
uniform float wind;
uniform float seed;
float density(vec3 p){
 float h=(p.y+.5);
 float sway=sin(time*4.+seed+h*5.)*.07*h*h+wind*h*h*.35;
 p.x-=sway;p.z-=cos(time*3.+seed+h*7.)*.025*h;
 float width=.185*pow(max(0.,sin(clamp(h,0.,1.)*3.14159)),.75)*(1.-h*.64);
 return (1.-smoothstep(width*.40,max(width,.0001),length(p.xz)))*smoothstep(0.,.08,h)*(1.-smoothstep(.76,1.,h));
}
void main(){
 vec3 direction=normalize(vPosition-eye);
 vec3 p=vPosition;
 float sum=0.;vec3 col=vec3(0.);
 for(int i=0;i<28;i++){
   float d=density(p)*.15;
   float h=p.y+.5;
   vec3 c=mix(vec3(.12,.22,1.5),vec3(1.8,.58,.07),smoothstep(.02,.18,h));
   c=mix(c,vec3(3.8,2.4,.95),(1.-smoothstep(.005,.045,length(p.xz)))*.72);
   col+=(1.-sum)*d*c;sum+=(1.-sum)*d;
   p+=direction*.042;
 }
 if(sum<.006)discard;
 gl_FragColor=vec4(col*heat*9.0,min(1.,sum*2.)*heat);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;

function texture(kind: "wood" | "stone" | "fabric" | "micro") {
 const n=512,canvas=document.createElement("canvas");canvas.width=canvas.height=n;
 const ctx=canvas.getContext("2d")!,im=ctx.createImageData(n,n);
 let seed=42;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const noise=rnd();let v=0,r=0,g=0,b=0;
   if(kind==="wood"){v=.4+.12*Math.sin(x*.12+Math.sin(y*.011)*3)+.055*Math.sin(x*.9+Math.sin(y*.025)*5)+noise*.10;r=94*v;g=55*v;b=34*v;}
   if(kind==="stone"){v=.58+.1*Math.sin(x*.012+y*.016)+.1*noise;const vein=Math.pow(Math.abs(Math.sin(x*.015+y*.009+Math.sin(y*.014)*2)),28);v-=vein*.35;r=v*100;g=v*98;b=v*95;}
   if(kind==="fabric"){v=.5+.2*((x%4<2?1:0)+(y%4<2?1:0))+.1*noise;r=v*165;g=v*135;b=v*111;}
   if(kind==="micro"){v=120+noise*95;r=g=b=v;}
   const j=(y*n+x)*4;im.data[j]=r;im.data[j+1]=g;im.data[j+2]=b;im.data[j+3]=255;
 }
 ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.colorSpace=kind==="micro"?THREE.NoColorSpace:THREE.SRGBColorSpace;t.repeat.set(kind==="micro"?6:3,kind==="micro"?6:3);t.anisotropy=4;return t;
}

function cutLightTexture(){
 const n=512,canvas=document.createElement("canvas");canvas.width=canvas.height=n;
 const ctx=canvas.getContext("2d")!;
 // A high, out-of-frame screen opens three soft windows in the pendant beam.
 // The room still has broad area light; this cookie only creates photographic
 // pools of direct light, so the pattern remains anchored when the camera moves.
 ctx.fillStyle="#080706";ctx.fillRect(0,0,n,n);
 const window=(cx:number,cy:number,rx:number,ry:number,angle:number)=>{
   ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();
 };
 ctx.save();ctx.filter="blur(18px)";ctx.fillStyle="rgba(255,247,226,.98)";
 window(70,325,53,260,-.43);window(250,196,72,285,-.50);window(465,205,66,270,-.46);
 ctx.restore();
 // Smaller gaps stop the bands from reading as a synthetic striped texture.
 ctx.save();ctx.filter="blur(10px)";ctx.fillStyle="rgba(255,238,207,.76)";
 window(112,73,73,27,.20);window(332,386,100,31,-.20);window(420,63,76,24,.28);
 ctx.restore();
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
 t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;
 return t;
}

export async function createScene(host: HTMLElement, initial: Settings, onLoad: (progress:number)=>void, onError:(s:string)=>void, onGift?:()=>void): Promise<SceneAPI> {
 let settings={...initial},disposed=false;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance",preserveDrawingBuffer:true});
 const basePixelRatio=Math.min(devicePixelRatio,1.5);
 renderer.setPixelRatio(basePixelRatio);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 // Geometry and light positions are static between configuration changes.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.12;
 renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
 renderer.domElement.setAttribute("aria-label","生日蛋糕三维场景，可拖动旋转并滚轮缩放");
 renderer.domElement.setAttribute("role","img");
 const contextLost=(e:Event)=>{e.preventDefault();onError("画面暂时中断，请重新加载场景。");};
 renderer.domElement.addEventListener("webglcontextlost",contextLost);
 const scene=new THREE.Scene();scene.background=new THREE.Color("#0b080a");scene.fog=new THREE.FogExp2("#0b080a",.025);
 const camera=new THREE.PerspectiveCamera(36,1,.05,70);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=4.6;controls.maxDistance=9;
 controls.minPolarAngle=.68;controls.maxPolarAngle=1.30;controls.minAzimuthAngle=-.6;controls.maxAzimuthAngle=.65;
 controls.rotateSpeed=.42;controls.zoomSpeed=.5;
 function reset(){camera.position.set(.10,3.65,5.8);controls.target.set(0,1.03,0);controls.update();}
 reset();
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.32;room.dispose();pmrem.dispose();
 RectAreaLightUniformsLib.init();
 // High diffused pendant: broad specular source plus a matching shadowed pool.
 const key=new THREE.RectAreaLight(0xffdfba,2.2,2.8,2.8);key.position.set(2.3,7.4,1.0);key.lookAt(0,1,0);scene.add(key);
 // A shadow-free moving softbox provides the opening sweep. The expensive
 // shadow-casting pendant stays fixed and fades in after the sweep passes.
 const stageSweep=new THREE.RectAreaLight(0xffe0b7,0,2.1,3.4);stageSweep.position.set(-3.8,6.8,2.5);stageSweep.lookAt(0,1,0);scene.add(stageSweep);
 const cool=new THREE.RectAreaLight(0x96afef,1.2,2,3);cool.position.set(3,4,-4);cool.lookAt(0,1,0);scene.add(cool);
 // A low, broad window bounce reveals berry bloom and frosting relief in the
 // key light's shadow without flattening the dark room.
 const detailFill=new THREE.RectAreaLight(0xb8c8ee,.18,2.4,2.0);detailFill.position.set(-3.2,3.4,3.0);detailFill.lookAt(-.35,1.05,0);scene.add(detailFill);
 const floralBounce=new THREE.RectAreaLight(0xffd5ac,0,1.8,2.2);floralBounce.position.set(-3.3,2.8,1.2);floralBounce.lookAt(-2.5,.95,-1.15);scene.add(floralBounce);
 const tableWash=new THREE.RectAreaLight(0xffe5c5,0,3.0,2.2);tableWash.position.set(1.8,3.4,1.7);tableWash.lookAt(1,.0,1.2);scene.add(tableWash);
 const keyShadow=new THREE.SpotLight(0xffdfba,100,18,.58,.42,2);keyShadow.position.copy(key.position);keyShadow.target.position.set(-.12,.8,0);
 const cutLight=cutLightTexture();
 keyShadow.castShadow=true;keyShadow.shadow.mapSize.set(2048,2048);keyShadow.shadow.bias=-.00008;keyShadow.shadow.normalBias=.004;
 keyShadow.shadow.camera.near=.5;keyShadow.shadow.camera.far=18;
 const fill=new THREE.HemisphereLight(0xb9c5d5,0x382219,.10);
 const tableBounce=new THREE.RectAreaLight(0x8c3c22,.3,4,2.2);tableBounce.position.set(0,.28,2.8);tableBounce.lookAt(0,1,0);
 scene.add(keyShadow,keyShadow.target,fill,tableBounce);
 const root=new THREE.Group();scene.add(root);
 const materials=new Set<THREE.Material>();const textures=new Set<THREE.Texture>();
 const micro=texture("micro");textures.add(micro);textures.add(cutLight);
 const mat=(color:THREE.ColorRepresentation,roughness=.5,metalness=0)=>{const m=new THREE.MeshPhysicalMaterial({color,roughness,metalness});materials.add(m);return m;};
 // Physical slats above the camera break the key light into an irregular indoor
 // pattern. They write only to the spotlight shadow map, so the source itself
 // remains out of frame while the projected shadows stay fixed in world space.
 const blockerMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});materials.add(blockerMaterial);
 const blockers=new THREE.Group();root.add(blockers);
 const blockerSpecs:[number,number,number,number][]=[[-.58,4.05,.05,-.27],[.22,4.2,-.18,-.15],[1.02,4.0,.34,-.34]];
 for(const [x,y,z,rotation] of blockerSpecs){
   const blocker=new THREE.Mesh(new THREE.BoxGeometry(.27,.055,2.75),blockerMaterial);
   blocker.position.set(x,y,z);blocker.rotation.y=rotation;blocker.castShadow=true;blockers.add(blocker);
 }
 const wood=texture("wood"),stone=texture("stone"),fabric=texture("fabric");[wood,stone,fabric].forEach(t=>textures.add(t));
 const photoWood=await new THREE.TextureLoader().loadAsync(`${PUBLIC_BASE}textures/walnut-photo-v1.png`);
 photoWood.colorSpace=THREE.SRGBColorSpace;photoWood.wrapS=photoWood.wrapT=THREE.RepeatWrapping;photoWood.repeat.set(2.1,1.58);
 photoWood.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.add(photoWood);
 const tableMaterial=new THREE.MeshPhysicalMaterial({map:photoWood,roughness:.62,clearcoat:.035,clearcoatRoughness:.78,bumpMap:photoWood,bumpScale:.012});materials.add(tableMaterial);
 const table=new THREE.Mesh(new THREE.BoxGeometry(18,.18,16),tableMaterial);table.position.set(0,-.11,0);table.receiveShadow=true;root.add(table);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(22,10,.3),mat("#0c090a",.9));wall.position.set(0,3.5,-7);root.add(wall);
 // A distant physical window with a sparse field of out-of-focus city lights.
 const glass=mat("#091524",.15,.3);glass.emissive.set("#101e36");glass.emissiveIntensity=.3;
 const windowPane=new THREE.Mesh(new THREE.BoxGeometry(5.5,4,.1),glass);windowPane.position.set(3,3.1,-6.8);root.add(windowPane);
 for(let i=0;i<3;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.055,4.1,.13),mat("#070707"));bar.position.set(.3+i*2.65,3.1,-6.6);root.add(bar);}
 const bulbMat=new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,.8,.26),transparent:true,opacity:.6});
 materials.add(bulbMat);
 for(let i=0;i<27;i++){const bulb=new THREE.Mesh(new THREE.SphereGeometry(.018+(i%4)*.015,8,8),bulbMat);bulb.position.set(.5+((i*1.71)%5),1.6+((i*.57)%2.8),-6.55);root.add(bulb);}
 const decorRoot=new THREE.Group();root.add(decorRoot);
 const linenMat=mat("#511c2b",.92);linenMat.sheen=1;linenMat.sheenColor.set("#914751");linenMat.bumpMap=micro;linenMat.bumpScale=.015;
 const clothGeo=new THREE.PlaneGeometry(2.8,5,56,80);clothGeo.rotateX(-Math.PI/2);
 const positions=clothGeo.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,.025+.11*Math.pow(Math.sin(x*7+Math.sin(z*1.8)*1.3),2)+.025*Math.cos(z*6));}
 clothGeo.computeVertexNormals();const cloth=new THREE.Mesh(clothGeo,linenMat);cloth.position.set(3,0,.4);cloth.rotation.y=-.3;cloth.receiveShadow=true;decorRoot.add(cloth);
 const brass=mat("#bb925b",.28,.88),darkCeramic=mat("#221915",.24);darkCeramic.clearcoat=.3;
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:number[],parent:THREE.Object3D=decorRoot){const o=new THREE.Mesh(g,m);o.position.set(p[0],p[1],p[2]);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 const plate=mesh(new THREE.CylinderGeometry(.70,.65,.07,64),darkCeramic,[-2.6,.045,1.4]);
 const rim=mesh(new THREE.TorusGeometry(.66,.014,8,64),brass,[-2.6,.086,1.4]);rim.rotation.x=Math.PI/2;
 const forkGroup=new THREE.Group();forkGroup.position.set(-2.62,.115,1.62);forkGroup.rotation.y=-.16;decorRoot.add(forkGroup);
 const forkHandle=mesh(new THREE.CapsuleGeometry(.043,.52,8,12),brass,[0,.018,.05],forkGroup);forkHandle.rotation.x=Math.PI/2;
 const forkNeck=mesh(new THREE.BoxGeometry(.095,.032,.20),brass,[0,.018,-.31],forkGroup);
 const forkShoulder=mesh(new THREE.BoxGeometry(.19,.031,.12),brass,[0,.018,-.46],forkGroup);
 for(let i=0;i<4;i++){
   const tine=mesh(new THREE.CapsuleGeometry(.011,.19,4,8),brass,[-.066+i*.044,.018,-.625],forkGroup);
   tine.rotation.x=Math.PI/2;
 }
 const giftGroup=new THREE.Group();decorRoot.add(giftGroup);giftGroup.position.set(2.25,-.02,1.35);giftGroup.rotation.y=-.35;
 const giftBase=new THREE.Group();giftGroup.add(giftBase);
 const giftPaper=mat("#242021",.82);giftPaper.bumpMap=micro;giftPaper.bumpScale=.0018;
 const giftBody=
 mesh(new THREE.BoxGeometry(.95,.6,.9),giftPaper,[0,.3,0],giftBase);
 const ribbonMaterial=mat("#702436",.39);ribbonMaterial.sheen=1;
 mesh(new THREE.BoxGeometry(.13,.61,.92),ribbonMaterial,[0,.31,0],giftBase);
 const lidPivot=new THREE.Group();lidPivot.position.set(0,.61,-.47);giftGroup.add(lidPivot);
 const giftLid=mesh(new THREE.BoxGeometry(1.02,.075,.98),giftPaper,[0,.038,.49],lidPivot);
 mesh(new THREE.BoxGeometry(.14,.018,1.0),ribbonMaterial,[0,.084,.49],lidPivot);
 for(let k=0;k<2;k++){const loop=mesh(new THREE.TorusGeometry(.16,.035,8,32),ribbonMaterial,[k===0?-.13:.13,.17,.49],lidPivot);loop.scale.set(1.2,.55,1);loop.rotation.set(.7,k===0?-.5:.5,0);}
 const seamMaterials=Array.from({length:4},()=>{const material=new THREE.MeshBasicMaterial({color:0xffb66d,transparent:true,opacity:.06,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});materials.add(material);return material;});
 const seamGlow=[
   mesh(new THREE.BoxGeometry(.91,.012,.011),seamMaterials[0],[0,.615,.444],giftBase),
   mesh(new THREE.BoxGeometry(.011,.012,.86),seamMaterials[1],[.466,.615,0],giftBase),
   mesh(new THREE.BoxGeometry(.91,.012,.011),seamMaterials[2],[0,.615,-.444],giftBase),
   mesh(new THREE.BoxGeometry(.011,.012,.86),seamMaterials[3],[-.466,.615,0],giftBase)
 ];
 seamGlow.forEach(edge=>{edge.castShadow=false;edge.receiveShadow=false;edge.renderOrder=2;});
 const seamLight=new THREE.PointLight(0xffb66d,0,1.45,2);seamLight.position.set(0,.64,0);giftGroup.add(seamLight);
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const contactCtx=contactCanvas.getContext('2d')!,contactGradient=contactCtx.createRadialGradient(64,64,8,64,64,62);contactGradient.addColorStop(0,'rgba(0,0,0,.46)');contactGradient.addColorStop(.58,'rgba(0,0,0,.22)');contactGradient.addColorStop(1,'rgba(0,0,0,0)');contactCtx.fillStyle=contactGradient;contactCtx.fillRect(0,0,128,128);const contactTexture=new THREE.CanvasTexture(contactCanvas);textures.add(contactTexture);const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,opacity:.72,depthWrite:false});materials.add(contactMaterial);const giftContact=new THREE.Mesh(new THREE.PlaneGeometry(1.42,1.24),contactMaterial);giftContact.rotation.x=-Math.PI/2;giftContact.position.y=.003;giftContact.renderOrder=1;giftGroup.add(giftContact);
 const fortuneCard=createFortuneCard(renderer,scene,camera,host);
 const rewardGlow=new THREE.PointLight(0xffbd6b,0,3.2,2);rewardGlow.position.set(0,.8,0);giftGroup.add(rewardGlow);
 let giftStart=-100,giftRevealed=false,giftOpen=false,giftHover=0,giftHoverTarget=0,lastGiftHoverCheck=0;
 const giftRaycaster=new THREE.Raycaster(),giftPointer=new THREE.Vector2();let giftPointerDown:THREE.Vector2|null=null;
 const updateGiftPointer=(event:PointerEvent)=>{const bounds=renderer.domElement.getBoundingClientRect();giftPointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);giftRaycaster.setFromCamera(giftPointer,camera);};
 const handleGiftPointerMove=(event:PointerEvent)=>{if(performance.now()-lastGiftHoverCheck<70)return;lastGiftHoverCheck=performance.now();updateGiftPointer(event);giftHoverTarget=!giftRevealed&&giftRaycaster.intersectObject(giftGroup,true).length?1:0;renderer.domElement.style.cursor=giftHoverTarget?'pointer':'';};
 const handleGiftPointerLeave=()=>{giftHoverTarget=0;renderer.domElement.style.cursor='';};
 const handleGiftPointerDown=(event:PointerEvent)=>{if(event.button===0)giftPointerDown=new THREE.Vector2(event.clientX,event.clientY);};
 const handleGiftPointerUp=(event:PointerEvent)=>{
   if(!giftPointerDown||giftPointerDown.distanceTo(new THREE.Vector2(event.clientX,event.clientY))>7){giftPointerDown=null;return;}
   giftPointerDown=null;updateGiftPointer(event);
   if(giftRaycaster.intersectObject(giftGroup,true).length)onGift?.();
 };
 renderer.domElement.addEventListener('pointermove',handleGiftPointerMove);
 renderer.domElement.addEventListener('pointerleave',handleGiftPointerLeave);
 renderer.domElement.addEventListener('pointerdown',handleGiftPointerDown);
 renderer.domElement.addEventListener('pointerup',handleGiftPointerUp);
 const flowers=new THREE.Group();decorRoot.add(flowers);flowers.position.set(-2.50,0,-1.15);
 const bouquets={} as Record<Cake,THREE.Group>;
 for(const name of ['chocolate','blueberry','redvelvet'] as Cake[]){const bouquet=makeBouquet(name,m=>materials.add(m),micro);bouquets[name]=bouquet;flowers.add(bouquet);}
 function hollowBox(width:number,depth:number,round=false){
   const shape=new THREE.Shape(),hole=new THREE.Path(),t=.035;
   if(round){shape.absarc(0,0,width/2,0,Math.PI*2,false);hole.absarc(0,0,width/2-t,0,Math.PI*2,true);}
   else{shape.moveTo(-width/2,-depth/2);shape.lineTo(width/2,-depth/2);shape.lineTo(width/2,depth/2);shape.lineTo(-width/2,depth/2);shape.closePath();hole.moveTo(-width/2+t,-depth/2+t);hole.lineTo(-width/2+t,depth/2-t);hole.lineTo(width/2-t,depth/2-t);hole.lineTo(width/2-t,-depth/2+t);hole.closePath();}
   shape.holes.push(hole);const geo=new THREE.ExtrudeGeometry(shape,{depth:.6,bevelEnabled:true,bevelSize:.005,bevelThickness:.005,bevelSegments:2,steps:1,curveSegments:32});geo.rotateX(-Math.PI/2);geo.translate(0,-.3,0);return geo;
 }
 const interior=mat('#201914',.97);mesh(new THREE.CylinderGeometry(.43,.43,.025,48),interior,[0,.025,0],giftBase);
 const giftShapes={
 chocolate:[hollowBox(1.12,.90),new THREE.BoxGeometry(1.19,.075,.98)],
 blueberry:[hollowBox(.95,.90),new THREE.BoxGeometry(1.02,.075,.98)],
 redvelvet:[hollowBox(.96,.96,true),new THREE.CylinderGeometry(.51,.51,.075,64)]
 };
 const oak:THREE.Texture=photoWood.clone();oak.needsUpdate=true;textures.add(oak);
 // Keep the photographed grain, with a separate neutral oak color grade.
 const oakCanvas=document.createElement('canvas');oakCanvas.width=oakCanvas.height=1024;
 const oakContext=oakCanvas.getContext('2d')!;oakContext.filter='grayscale(40%) brightness(1.12) contrast(1.15)';oakContext.drawImage(photoWood.image,0,0,1024,1024);oak.source=new THREE.Source(oakCanvas);
 const roseWood:THREE.Texture=photoWood.clone();const roseCanvas=document.createElement('canvas');roseCanvas.width=roseCanvas.height=1024;
 const roseContext=roseCanvas.getContext('2d')!;roseContext.filter='brightness(1.35) saturate(.8)';roseContext.drawImage(photoWood.image,0,0,1024,1024);
 roseContext.globalCompositeOperation='soft-light';roseContext.fillStyle='#a76d60';roseContext.fillRect(0,0,1024,1024);
 roseWood.source=new THREE.Source(roseCanvas);roseWood.needsUpdate=true;textures.add(roseWood);
 const stoneCanvas=document.createElement('canvas');stoneCanvas.width=stoneCanvas.height=1024;
 const stoneContext=stoneCanvas.getContext('2d')!,pixels=stoneContext.createImageData(1024,1024);
 let stoneSeed=82;const randomStone=()=>{stoneSeed=(stoneSeed*1664525+1013904223)>>>0;return stoneSeed/4294967296;};
 for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const n=randomStone(),band=Math.sin(y*.09+Math.sin(x*.008)*1.4)*3+Math.sin(y*.019)*5, pore=n>.995?-24:0,j=(y*1024+x)*4;pixels.data[j]=174+band+n*8+pore;pixels.data[j+1]=163+band+n*8+pore;pixels.data[j+2]=144+band+n*8+pore;pixels.data[j+3]=255;}
 stoneContext.putImageData(pixels,0,0);const travertine=new THREE.CanvasTexture(stoneCanvas);travertine.colorSpace=THREE.SRGBColorSpace;travertine.wrapS=travertine.wrapT=THREE.RepeatWrapping;travertine.repeat.set(3,3);textures.add(travertine);
 const blueberryDetails=new THREE.Group();decorRoot.add(blueberryDetails);
 const blueCeramic=mat('#536d7c',.31);blueCeramic.clearcoat=.18;
 const coaster=mesh(new THREE.CylinderGeometry(.33,.34,.025,48),brass,[-2.0,.006,.05],blueberryDetails);
 const cupProfile=[[.14,0],[.19,.035],[.20,.20],[.185,.255],[.17,.255],[.175,.20],[.16,.04]];
 mesh(new THREE.LatheGeometry(cupProfile.map(([r,y])=>new THREE.Vector2(r,y)),40),blueCeramic,[-2.0,.026,.05],blueberryDetails);
 const tea=mat('#382114',.14);mesh(new THREE.CylinderGeometry(.173,.173,.005,40),tea,[-2.0,.22,.05],blueberryDetails);
 const cupHandle=mesh(new THREE.TorusGeometry(.083,.015,8,24),blueCeramic,[-2.23,.15,.05],blueberryDetails);cupHandle.rotation.y=Math.PI/2;
 const cardCanvas=document.createElement("canvas");cardCanvas.width=512;cardCanvas.height=256;
 const cardCtx=cardCanvas.getContext("2d")!;cardCtx.fillStyle="#e1d2b9";cardCtx.fillRect(0,0,512,256);
 cardCtx.fillStyle="#493125";cardCtx.font="italic 58px Georgia";cardCtx.textAlign="center";cardCtx.fillText("For You",256,150);
 const cardTex=new THREE.CanvasTexture(cardCanvas);cardTex.colorSpace=THREE.SRGBColorSpace;textures.add(cardTex);
 const cardMat=new THREE.MeshStandardMaterial({map:cardTex,roughness:.9,side:THREE.DoubleSide});materials.add(cardMat);
 const card=mesh(new THREE.BoxGeometry(.59,.30,.008),cardMat,[.60,1.49,.50],root);card.rotation.set(-.10,-.18,0);
 // The card is held above the frosting by a short food-safe pick embedded in it.
 const cardPick=mesh(new THREE.CylinderGeometry(.007,.007,.21,8),mat('#b69467',.62),[.60,1.285,.50],root);
 const cakeNames:Cake[]=["chocolate","blueberry","redvelvet"];
 const models:Partial<Record<Cake,THREE.Group>>={};
 const modelLoads:Partial<Record<Cake,Promise<THREE.Group|undefined>>>={};
 const draco=new DRACOLoader();draco.setDecoderPath(`${PUBLIC_BASE}decoders/draco/`);draco.setWorkerLimit(2);
 const loader=new GLTFLoader();loader.setDRACOLoader(draco);
 function loadCake(name:Cake){
   if(models[name])return Promise.resolve(models[name]);
   if(modelLoads[name])return modelLoads[name]!;
   const request=(async()=>{
     const gltf=await loader.loadAsync(`${PUBLIC_BASE}models/patisserie-v3/${name}.glb?v=material-contact-7`);
     if(disposed)return;
     const cakeMaterialSet=new Set<THREE.Material>(),cakeMeshList:THREE.Mesh[]=[];
     gltf.scene.traverse(o=>{
       if(o instanceof THREE.Mesh){cakeMeshList.push(o);o.castShadow=name===settings.cake;o.receiveShadow=true;
         const ms=Array.isArray(o.material)?o.material:[o.material];
         ms.forEach(m=>{materials.add(m);cakeMaterialSet.add(m);if(m instanceof THREE.MeshStandardMaterial){
           m.envMapIntensity=.65;m.bumpMap=m.normalMap?null:micro;m.bumpScale=m.name.includes("cream")?.025:.009;
           for(const t of [m.map,m.normalMap,m.roughnessMap,m.metalnessMap,m.aoMap])if(t){textures.add(t);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
           if(m.name.includes("blueberry"))m.bumpScale=.018;
           if(m.name.includes("roasted_hazelnut")){m.roughness=.76;m.bumpScale=.026;m.envMapIntensity=.07;}
           // glTF roughness maps carry the authored values: a factor below one
           // multiplies them and accidentally turns matte cocoa into polished plastic.
           if(m.name.includes("chocolate_ribbon")){m.envMapIntensity=.30;m.roughness=m.roughnessMap?1:.56;}
           if(m.name==="ganache"){m.normalScale.multiplyScalar(1.35);m.envMapIntensity=.4;}
           if(name==='redvelvet'){
             if(/cream|red_velvet_crumb/.test(m.name)){m.normalScale.multiplyScalar(.85);m.roughness=.82;m.envMapIntensity=.3;m.aoMapIntensity=.65;
               if(m instanceof THREE.MeshPhysicalMaterial){m.clearcoat=.035;m.clearcoatRoughness=.55;m.sheen=.12;m.sheenColor.set('#fff1dc');}}
             if(m.name==='velvet_crumb'){m.color.set('#7b1626');m.roughness=.94;m.envMapIntensity=.12;}
           }
           edibleSurface(m,name==='redvelvet');
           if(m instanceof THREE.MeshPhysicalMaterial&&m.name.includes("amarena_cherry")){
             m.roughness=.28;m.clearcoat=.18;m.clearcoatRoughness=.16;m.ior=1.46;
             // Opaque fruit skin: even tiny transmission triggers another full-scene render.
             m.transmission=0;m.thickness=.16;m.attenuationColor.set("#350006");m.attenuationDistance=.48;m.envMapIntensity=.22;
           }
         }});
       }
     });
     models[name]=gltf.scene;gltf.scene.visible=settings.cake===name;root.add(gltf.scene);
     renderer.shadowMap.needsUpdate=true;
     return gltf.scene;
   })();
   modelLoads[name]=request;return request;
 }
 try{await loadCake(initial.cake);onLoad(1);}
 catch(e){renderer.dispose();host.replaceChildren();throw e;}
 // Decode one alternative at a time, after entrance/card warm-up and only when
 // the foreground has spare frame budget. Explicit cake selection still loads immediately.
 const pendingCakes=cakeNames.filter(name=>name!==initial.cake);
 let cancelPreload=()=>{},lastInteraction=performance.now();
 const noteInteraction=()=>{lastInteraction=performance.now();};
 host.addEventListener('pointerdown',noteInteraction,{passive:true});
 host.addEventListener('wheel',noteInteraction,{passive:true});
 function preloadNext(){
  if(disposed||!pendingCakes.length)return;
  if(document.hidden||giftRevealed||performance.now()-lastInteraction<4000||Number(host.dataset.fps||0)<40){cancelPreload=scheduleIdleWork(preloadNext,4000);return;}
  const name=pendingCakes.shift()!;
  void loadCake(name).catch(()=>{}).finally(()=>{if(!disposed)cancelPreload=scheduleIdleWork(preloadNext,4000);});
 }
 cancelPreload=scheduleIdleWork(preloadNext,12000);
 fortuneCard.prepare(initial.cake);
 type Candle={group:THREE.Group;flame:THREE.Mesh<THREE.BoxGeometry,THREE.ShaderMaterial>;halo:THREE.Sprite;height:number;heat:number;delay:number;wick:THREE.Mesh;smoke:THREE.Points;smokeAge:number;target:THREE.Vector3;velocity:THREE.Vector3;presence:number;targetPresence:number};
 const candles:Candle[]=[];const candleRoot=new THREE.Group();root.add(candleRoot);
 // A fixed light rig avoids recompiling every cake material whenever the visible
 // candle count changes. Individual flames still animate independently.
 const candleLights=[new THREE.PointLight(0xffac55,0,4,2),new THREE.PointLight(0xffac55,0,4,2)];
 candleLights.forEach(light=>candleRoot.add(light));
 const wax=mat("#853045",.39);wax.clearcoat=.2;
 const insertionCream=mat(initial.cake==='chocolate'?'#382017':'#ead5b4',.8);
 const insertionShade=new THREE.MeshBasicMaterial({color:'#26140c',transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide});materials.add(insertionShade);
 const surfaceProbe=new THREE.Raycaster();
 const wickMat=new THREE.MeshStandardMaterial({color:"#1d0b07",emissive:"#fb591d",emissiveIntensity:0});materials.add(wickMat);
 const flameGeo=new THREE.BoxGeometry(.46,1,.46);
 const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
 const haloCtx=haloCanvas.getContext('2d')!,haloGradient=haloCtx.createRadialGradient(64,64,0,64,64,64);
 haloGradient.addColorStop(0,'rgba(255,203,120,.32)');haloGradient.addColorStop(.16,'rgba(255,155,58,.17)');haloGradient.addColorStop(.5,'rgba(255,125,34,.035)');haloGradient.addColorStop(1,'rgba(255,110,20,0)');
 haloCtx.fillStyle=haloGradient;haloCtx.fillRect(0,0,128,128);
 const haloTexture=new THREE.CanvasTexture(haloCanvas);haloTexture.colorSpace=THREE.SRGBColorSpace;textures.add(haloTexture);
 function createCandlePool(){
   // Allocate the maximum once. Quantity changes only move and hide groups,
   // avoiding shader compilation, GPU buffer churn and point-light disposal.
   for(let i=0;i<12;i++){
     const g=new THREE.Group();candleRoot.add(g);
     const height=.82+Math.sin(i*3.7)*.075;
     const candleBody=mesh(new THREE.CylinderGeometry(.034,.038,height,16),wax,[0,height/2,0],g);
     candleBody.castShadow=false;
     // A shallow pressed rim and a narrow crevice mark the wax entering frosting.
     const pressedGeo=new THREE.TorusGeometry(.042,.009,6,24);
     const pressedPositions=pressedGeo.attributes.position;
     for(let v=0;v<pressedPositions.count;v++){
       const x=pressedPositions.getX(v),y=pressedPositions.getY(v),angle=Math.atan2(y,x),variation=1+.07*Math.sin(angle*5+i*1.7);
       pressedPositions.setXYZ(v,x*variation,y*variation,pressedPositions.getZ(v)*.48);
     }
     pressedGeo.computeVertexNormals();
     const pressed=mesh(pressedGeo,insertionCream,[0,.016,0],g);pressed.rotation.x=-Math.PI/2;pressed.castShadow=false;
     const crevice=mesh(new THREE.RingGeometry(.035,.043,24),insertionShade,[0,.017,0],g);crevice.rotation.x=-Math.PI/2;crevice.castShadow=false;
     const topWax=mesh(new THREE.TorusGeometry(.025,.009,7,16),wax,[0,height,0],g);topWax.rotation.x=Math.PI/2;topWax.castShadow=false;
     const wick=mesh(new THREE.CylinderGeometry(.004,.005,.034,6),wickMat.clone(),[0,height+.014,0],g);
     wick.castShadow=false;
     const fm=new THREE.ShaderMaterial({vertexShader:flameVertex,fragmentShader:flameFragment,transparent:true,depthWrite:false,side:THREE.FrontSide,uniforms:{time:{value:0},heat:{value:0},eye:{value:new THREE.Vector3()},seed:{value:i*2.39},wind:{value:0}},toneMapped:true});
     const f=new THREE.Mesh(flameGeo,fm);f.scale.set(.30,.28,.30);f.position.y=height+.15;g.add(f);
     const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));halo.position.y=height+.15;halo.scale.set(.67,.85,1);g.add(halo);
     const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.Float32BufferAttribute(new Float32Array(36*3),3));
     const sm=new THREE.PointsMaterial({color:"#bbb4b0",size:.025,transparent:true,opacity:0,depthWrite:false});
     const smoke=new THREE.Points(sg,sm);smoke.position.y=height;g.add(smoke);
     candles.push({group:g,flame:f,halo,height,heat:settings.lit?1:0,delay:i*.14,wick,smoke,smokeAge:100,target:new THREE.Vector3(),velocity:new THREE.Vector3(),presence:0,targetPresence:0});
   }
 }
 function syncCandles(count:number,snap=false){
   const radius=count===1?0:count>8?.54:.43;
   for(let i=0;i<candles.length;i++){
     const candle=candles[i],visible=i<count;candle.targetPresence=visible?1:0;
     if(visible){
       const angle=i/count*Math.PI*2+.4,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
       let surfaceHeight=1.228;
       const model=models[settings.cake];
       if(model){root.updateMatrixWorld(true);surfaceProbe.set(root.localToWorld(new THREE.Vector3(x,1.32,z)),new THREE.Vector3(0,-1,0));
         const hit=surfaceProbe.intersectObject(model,true)[0];
         if(hit){const local=root.worldToLocal(hit.point.clone());if(local.y>1.1&&local.y<1.32)surfaceHeight=local.y;}}
       candle.target.set(x,surfaceHeight-.015,z);
       if(snap||candle.presence<.002){candle.group.position.copy(candle.target);candle.velocity.set(0,0,0);}
       candle.group.visible=true;
     }
     if(snap){candle.presence=candle.targetPresence;candle.group.scale.setScalar(candle.presence||.001);candle.group.visible=visible;}
   }
 }
 createCandlePool();syncCandles(settings.candles,true);
 let litTime=0,blowTime=-100,clockTime=0,ambientChangeTime=-100;
 let roomLevel=initial.ambient?1:0;
 let lightShadowTime=-100,lastLightShift=0;
 function update(s:Settings){
   const old=settings;settings={...s};
   if(old.cake!==s.cake){lastInteraction=performance.now();fortuneCard.prepare(s.cake);}
   // The pooled candles do not cast into the expensive 2048px spotlight map,
   // so editing their quantity can stay a lightweight visibility/layout update.
   if(old.cake!==s.cake||old.decor!==s.decor)renderer.shadowMap.needsUpdate=true;
   if(old.lit!==s.lit){litTime=clockTime;if(!s.lit){blowTime=clockTime;for(const c of candles)c.smokeAge=0;}}
   if(old.ambient!==s.ambient&&s.ambient)ambientChangeTime=clockTime;
   if(old.candles!==s.candles||old.cake!==s.cake)syncCandles(s.candles);
   insertionCream.color.set(s.cake==='chocolate'?'#382017':s.cake==='blueberry'?'#e5d1b5':'#ead8bd');
   if(!models[s.cake])void loadCake(s.cake).catch(()=>onError("这款蛋糕暂时未能加载，请重试。"));
   for(const name of cakeNames){if(models[name]){models[name]!.visible=s.cake===name;models[name]!.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});}bouquets[name].visible=name===s.cake;}
   blueberryDetails.visible=s.cake==="blueberry";
   const theme=THEMES[s.cake];
   wax.color.set(s.cake==='blueberry'?'#e5d4b5':'#8e3345');linenMat.color.set(theme.cloth);linenMat.sheenColor.set(theme.cloth);ribbonMaterial.color.set(theme.ribbon);
   ribbonMaterial.roughness=s.cake==='blueberry'?.65:.36;ribbonMaterial.bumpMap=micro;ribbonMaterial.bumpScale=.0012;
   giftPaper.color.set(theme.paper);giftBody.geometry=giftShapes[s.cake][0];giftLid.geometry=giftShapes[s.cake][1];
   const seamColor=s.cake==='blueberry'?0xbcdcff:s.cake==='redvelvet'?0xffc083:0xffad62;seamMaterials.forEach(material=>material.color.setHex(seamColor));seamLight.color.setHex(seamColor);
   brass.color.set(theme.metal);brass.roughness=s.cake==='blueberry'?.36:.27;darkCeramic.color.set(theme.plate);
   cloth.scale.set(s.cake==='blueberry'?.68:1,1,s.cake==='blueberry'?.73:1);
   key.color.set(theme.light);keyShadow.color.set(theme.light);stageSweep.color.set(theme.light);
   tableMaterial.map=s.cake==='redvelvet'?roseWood:({walnut:photoWood,oak,travertine,marble:stone,linen:fabric})[s.table];
   tableMaterial.bumpMap=tableMaterial.map;tableMaterial.bumpScale=s.cake==='redvelvet'?.007:s.table==='travertine'?.003:.009;tableMaterial.roughness=s.cake==='redvelvet'?.48:s.table==='linen'?.92:s.table==='travertine'?.74:s.table==='marble'?.40:.60;tableMaterial.needsUpdate=true;
   flowers.visible=s.decor==="flowers";giftGroup.visible=s.decor!=="minimal"||giftRevealed;cloth.visible=false;
 }
 update(initial);
 let quality=1;
 function resize(){
   const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;
   camera.clearViewOffset();
   if(w>800){camera.fov=36;camera.setViewOffset(w,h,w*.11,0,w,h);}
   else {camera.fov=43;}
   camera.updateProjectionMatrix();
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 let previousTime=performance.now(),frame=0,fpsTime=0,frames=0,slowWindows=0;
 const qualityWarmupUntil=performance.now()+12000;
 let stageVisible=true;const visibility=new IntersectionObserver(entries=>{stageVisible=entries[0].isIntersecting;},{rootMargin:"100px"});visibility.observe(host);
 const localEye=new THREE.Vector3(),candleForce=new THREE.Vector3();
 function tick(){
   if(disposed)return;
   frame=requestAnimationFrame(tick);
   const now=performance.now(),elapsed=Math.max(0,(now-previousTime)/1000),dt=Math.min(elapsed,.05);previousTime=now;clockTime+=dt;
   if(document.hidden||!stageVisible)return;
   controls.update();
   // Opening the room light is staged: a soft source crosses left-to-right,
   // then the stationary pendant and its patterned shadows settle in behind it.
   const stageTime=clockTime-ambientChangeTime;
   const stageClamp=(v:number)=>THREE.MathUtils.clamp(v,0,1),stageEase=(v:number)=>{v=stageClamp(v);return v*v*(3-2*v);};
   const sweepProgress=settings.ambient?stageEase(stageTime/1.75):1;
   const roomTarget=settings.ambient?stageEase((stageTime-.52)/1.18):0;
   roomLevel=THREE.MathUtils.damp(roomLevel,roomTarget,settings.ambient?5.2:7.5,dt);
   stageSweep.position.x=THREE.MathUtils.lerp(-3.8,3.55,sweepProgress);
   stageSweep.position.z=2.5-Math.sin(sweepProgress*Math.PI)*.45;
   stageSweep.lookAt(0,1.05,0);
   stageSweep.intensity=settings.ambient?Math.pow(Math.sin(Math.PI*sweepProgress),1.25)*5.2:0;
   // A small physical movement of the overhead source lets the tabletop pool,
   // specular reflection and cake shadow settle together after the opening sweep.
   const lightShift=settings.ambient?(1-sweepProgress)*-.38:0;
   key.position.x=2.3+lightShift;key.lookAt(0,1,0);
   keyShadow.position.copy(key.position);keyShadow.target.position.x=-.12+lightShift*.25;
   if(Math.abs(lightShift-lastLightShift)>.004&&clockTime-lightShadowTime>.09){
     renderer.shadowMap.needsUpdate=true;lightShadowTime=clockTime;lastLightShift=lightShift;
   }
   const cakeLightScale=settings.cake==="blueberry"?.62:settings.cake==="redvelvet"?.78:1;
   key.intensity=roomLevel*2.75*cakeLightScale;
   keyShadow.intensity=roomLevel*305*cakeLightScale;
   cool.intensity=.11+roomLevel*.38;
   const velvet=settings.cake==='redvelvet';
   detailFill.intensity=(velvet?.16:.075)+roomLevel*.24;
   floralBounce.intensity=THREE.MathUtils.damp(floralBounce.intensity,velvet?.65+roomLevel*.35:0,3,dt);
   tableWash.intensity=THREE.MathUtils.damp(tableWash.intensity,velvet?.28+roomLevel*.30:0,3,dt);
   fill.intensity=.014+roomLevel*.082;
   tableBounce.intensity=roomLevel*.36;
   scene.environmentIntensity=.018+roomLevel*.090;
   giftHover=THREE.MathUtils.damp(giftHover,giftHoverTarget,7,dt);
   const hintCycle=(clockTime+.35)%3.55,hintEnvelope=!giftRevealed&&hintCycle<1.35?Math.pow(Math.sin(Math.PI*hintCycle/1.35),2):0;
   const revealAge=performance.now()/1000-giftStart,revealEnvelope=giftRevealed&&revealAge<1.05?Math.pow(1-THREE.MathUtils.clamp(revealAge/1.05,0,1),.55):0;
   const seamBase=giftRevealed?0:.055,seamEnergy=Math.max(giftHover*.72,revealEnvelope*.95,hintEnvelope*.58);
   for(let i=0;i<seamMaterials.length;i++){
     const phase=Math.max(0,hintCycle-i*.11),progress=!giftRevealed&&phase<1.05?Math.pow(Math.sin(Math.PI*phase/1.05),2):0;
     const localEnergy=Math.max(giftHover*.72,revealEnvelope*.95,progress*.58);
     seamMaterials[i].opacity=seamBase+localEnergy*.54;
   }
   seamLight.intensity=seamBase*.16+seamEnergy*.48;
   if(!giftRevealed&&Math.abs(lidPivot.rotation.x-(giftOpen?-1.48:0))>.001)renderer.shadowMap.needsUpdate=true;
   if(!giftRevealed)lidPivot.rotation.x=THREE.MathUtils.damp(lidPivot.rotation.x,giftOpen?-1.48:0,4.5,dt);
   if(giftRevealed){
     const giftTime=Math.max(0,performance.now()/1000-giftStart),clamp=(v:number)=>THREE.MathUtils.clamp(v,0,1),ease=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
     lidPivot.rotation.x=-1.48*ease((giftTime-.08)/.82);
     fortuneCard.update(giftTime,dt);
     if(giftTime<1.1)renderer.shadowMap.needsUpdate=true;
     rewardGlow.intensity=Math.max(0,Math.sin(Math.PI*clamp((giftTime-.42)/2.0)))*2.6;
   }

   for(let i=0;i<candles.length;i++){
     const c=candles[i];
     if(c.targetPresence>0){
       candleForce.copy(c.target).sub(c.group.position).multiplyScalar(38).addScaledVector(c.velocity,-10);
       c.velocity.addScaledVector(candleForce,dt);c.group.position.addScaledVector(c.velocity,dt);
     }
     c.presence=THREE.MathUtils.damp(c.presence,c.targetPresence,c.targetPresence?10:13,dt);
     const presenceEase=c.presence*c.presence*(3-2*c.presence);c.group.scale.setScalar(Math.max(.001,presenceEase));
     if(c.presence<.002&&c.targetPresence===0){c.group.visible=false;c.heat=0;c.flame.visible=false;c.halo.visible=false;c.smoke.visible=false;continue;}
     c.group.visible=true;
     const target=settings.lit&&c.targetPresence>0&&clockTime-litTime>c.delay?1:0;
     c.heat=THREE.MathUtils.damp(c.heat,target,target?6:9,dt);
     const flutter=1+.05*Math.sin(clockTime*9+i*2.3)+.025*Math.sin(clockTime*19+i);
     const wind=Math.max(0,1-(clockTime-blowTime)/.55);
     c.flame.visible=c.heat>.005;
     c.halo.visible=c.flame.visible;c.halo.material.opacity=c.heat*flutter;
     c.flame.scale.y=.28*flutter*(.6+.4*c.heat);
     c.flame.material.uniforms.time.value=clockTime;
     c.flame.material.uniforms.heat.value=c.heat;
     c.flame.material.uniforms.wind.value=wind;
     c.flame.updateWorldMatrix(true,false);localEye.copy(camera.position);c.flame.worldToLocal(localEye);c.flame.material.uniforms.eye.value.copy(localEye);
     const wm=c.wick.material as THREE.MeshStandardMaterial;wm.emissiveIntensity=c.heat*.6+Math.exp(-c.smokeAge*2)*1.5;
     c.smokeAge+=dt;const sm=c.smoke.material as THREE.PointsMaterial;
     sm.opacity=c.smokeAge<3&&!settings.lit?.21*Math.sin(Math.PI*Math.min(c.smokeAge/3,1)):0;
     c.smoke.visible=sm.opacity>.001;
     if(c.smoke.visible){const p=c.smoke.geometry.attributes.position;
       for(let j=0;j<p.count;j++){const t=c.smokeAge*.4+j*.012;p.setXYZ(j,Math.sin(t*9+i)*.055*t,t,Math.cos(t*6+j*.2)*.022*t);}p.needsUpdate=true;}
   }
   for(let i=0;i<candleLights.length;i++){
     const source=candles[Math.min(i,Math.max(0,settings.candles-1))];
     candleLights[i].position.set(source.group.position.x,source.group.position.y+source.height+.08,source.group.position.z);
     candleLights[i].intensity=source.heat*source.presence*(settings.candles>1?1.25:.9);
   }
   fortuneCard.render();
   frames++;fpsTime+=elapsed;if(fpsTime>3){
     const fps=frames/fpsTime;host.dataset.fps=String(Math.round(fps));host.dataset.triangles=String(renderer.info.render.triangles);
     // Asset decoding is a one-off cost, not evidence that every frame needs fewer pixels.
     if(now>qualityWarmupUntil){
       slowWindows=fps<18?slowWindows+1:0;
       const minimum=host.clientWidth>800?.85:.70;
       let next=quality;
       if(slowWindows>=2){next=Math.max(minimum,quality-.10);slowWindows=0;}
       else if(fps>48&&quality<1)next=Math.min(1,quality+.05);
       if(next!==quality){quality=next;renderer.setPixelRatio(basePixelRatio*quality);resize();}
     }
     host.dataset.quality=String(quality);
     frames=0;fpsTime=0;
   }
 }
 tick();
 return {tiltReward:fortuneCard.tilt,captureReward:fortuneCard.capture,toggleGift:()=>{fortuneCard.close();controls.enabled=true;giftOpen=!giftOpen;if(giftRevealed){giftRevealed=false;giftOpen=false;rewardGlow.intensity=0;card.visible=true;cardPick.visible=true;}renderer.shadowMap.needsUpdate=true;},prepareCake:async(name:Cake)=>{await loadCake(name);},update,reset,blow:()=>update({...settings,lit:false}),revealReward:(fortune:Fortune)=>{fortuneCard.start(settings.cake,fortune);controls.enabled=false;giftHover=giftHoverTarget=0;giftStart=performance.now()/1000;giftRevealed=true;giftOpen=true;giftGroup.visible=true;lidPivot.rotation.x=0;renderer.shadowMap.needsUpdate=true;},capture:()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL("image/png");},dispose:()=>{
   disposed=true;cancelPreload();host.removeEventListener('pointerdown',noteInteraction);host.removeEventListener('wheel',noteInteraction);fortuneCard.dispose();cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();controls.dispose();
   renderer.domElement.removeEventListener("webglcontextlost",contextLost);
   renderer.domElement.removeEventListener('pointermove',handleGiftPointerMove);renderer.domElement.removeEventListener('pointerleave',handleGiftPointerLeave);
   renderer.domElement.removeEventListener('pointerdown',handleGiftPointerDown);renderer.domElement.removeEventListener('pointerup',handleGiftPointerUp);
   renderer.domElement.style.cursor='';
   root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points)o.geometry.dispose();});
   for(const c of candles){c.flame.material.dispose();c.halo.material.dispose();(c.smoke.material as THREE.Material).dispose();}
   candleLights.forEach(light=>light.dispose());
   Object.values(giftShapes).flat().forEach(g=>g.dispose());
   materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());env.dispose();draco.dispose();renderer.dispose();renderer.domElement.remove();
 }};
}


