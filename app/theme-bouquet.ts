import * as THREE from 'three';
import type { Cake } from './scene-engine';

// Curved petal sheets, rather than ellipsoids; repeated petals share a draw call.
export function makeBouquet(cake:Cake, register:(m:THREE.Material)=>void, micro:THREE.Texture){
 const root=new THREE.Group();
 const material=(color:string,roughness=.6)=>{const m=new THREE.MeshPhysicalMaterial({color,roughness,side:THREE.DoubleSide});register(m);return m;};
 const stem=material('#344336',.84),leaf=material('#304235',.72);
 const petal=material(cake==='chocolate'?'#681e35':'#eee2cc',.57);petal.sheen=.55;petal.sheenColor.set('#ead4c0');petal.bumpMap=micro;petal.bumpScale=.001;
 const blue=material('#677cae',.64);
 const vaseMat=material(cake==='redvelvet'?'#d6cbb9':cake==='blueberry'?'#c6d6d8':'#86603a',.18);
 vaseMat.side=THREE.DoubleSide;vaseMat.clearcoat=.6;
 if(cake!=='redvelvet'){vaseMat.transparent=true;vaseMat.opacity=cake==='blueberry'?.28:.6;vaseMat.depthWrite=false;}
 const add=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=!mat.transparent;m.receiveShadow=true;root.add(m);return m;};
 const profile=cake==='redvelvet'?[[.25,0],[.32,.08],[.34,.35],[.26,.65],[.22,.72]]:[[.27,0],[.29,.06],[.26,.56],[.19,.83],[.19,.87]];
 add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48),vaseMat,0,.015,0);
 if(cake!=='redvelvet'){const water=material('#9baeb0',.12);water.transparent=true;water.opacity=.18;water.depthWrite=false;add(new THREE.CylinderGeometry(.26,.26,.015,40),water,0,.46,0);}
 const geo=new THREE.PlaneGeometry(1,1,10,12),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const u=pos.getX(i)*2,t=pos.getY(i)+.5;const width=Math.pow(Math.sin(Math.PI*t),.65);pos.setXYZ(i,u*width*.5,t,.32*t*t+.13*u*u*width+.018*Math.sin(t*18+u*3)*t);}
 geo.computeVertexNormals();
 const count=cake==='chocolate'?5:cake==='blueberry'?7:6,petals=cake==='chocolate'?46:cake==='blueberry'?17:38;
 const instances=new THREE.InstancedMesh(geo,petal,count*petals);instances.castShadow=true;instances.receiveShadow=true;root.add(instances);
 const dummy=new THREE.Object3D();let index=0;
 for(let k=0;k<count;k++){
   const angle=k*2.399,x=Math.cos(angle)*(cake==='blueberry'?.47:.34),z=Math.sin(angle)*.28;
   const h=cake==='chocolate'?1.32+k%3*.20:cake==='blueberry'?1.15+k%4*.17:1.02+k%3*.10;
   const end=new THREE.Vector3(x,h,z),path=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.13,.07,z*.13),new THREE.Vector3(x*.18,.90,z*.18),end]);
   add(new THREE.TubeGeometry(path,14,.009,5,false),stem,0,0,0);
   for(let j=0;j<2;j++){const l=add(geo,leaf,x*(.25+j*.25),.96+j*.10,z*(.25+j*.25));l.rotation.set(.7,k*2.2+j,1.0);l.scale.set(.10,.24,.20);}
   for(let j=0;j<petals;j++){
     const ring=Math.floor(j/(cake==='chocolate'?10:8)),a=j*2.399+k*.31,r=.017+ring*.030;
     dummy.position.set(x+Math.cos(a)*r,h-ring*.013,z+Math.sin(a)*r);
     dummy.rotation.set(.30+ring*.26+.08*Math.sin(j*1.8),a,.10*Math.sin(j*4));
     const length=cake==='chocolate'?.095+ring*.025:.11+ring*.037;
     dummy.scale.set(cake==='chocolate'?.065:.12,length,.26);dummy.updateMatrix();instances.setMatrixAt(index,dummy.matrix);
     const tint=new THREE.Color(cake==='redvelvet'?(k%3===0?'#a34056':k%3===1?'#fff0d4':'#dfb5a8'):'#ffffff');
     tint.multiplyScalar(.86+.14*(.5+.5*Math.sin(j*8.1+k)));
     instances.setColorAt(index,tint);index++;
   }
 }
 if(cake==='blueberry')for(let k=0;k<2;k++){
   const x=k===0?-.48:.36,h=1.86-k*.18;
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,.08,0),new THREE.Vector3(x*.18,.9,-.04),new THREE.Vector3(x,h,-.18)]),18,.008,5),stem,0,0,0);
   for(let j=0;j<8;j++)for(let p=0;p<5;p++){const f=add(geo,blue,x+Math.sin(j*2.4)*.055,1.15+j*.08,-.18+Math.cos(j*2.4)*.055);f.rotation.set(.6,p*Math.PI*.4+j,.1);f.scale.set(.047,.067,.09);}
 }
 return root;
}
