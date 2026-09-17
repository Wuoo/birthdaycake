"""Original, exportable food microstructure. No photographed lighting in albedo."""
import bpy
import numpy as np
from math import sin,cos,pi,exp
from mathutils import Vector, noise

def field(rng,size,cells):
    grid=rng.random((cells,cells)).astype(np.float32)
    p=np.arange(size,dtype=np.float32)*cells/size
    i=p.astype(int);f=p-i;f=f*f*(3-2*f)
    a=grid[i[:,None]%cells,i[None,:]%cells]
    b=grid[i[:,None]%cells,(i[None,:]+1)%cells]
    c=grid[(i[:,None]+1)%cells,i[None,:]%cells]
    d=grid[(i[:,None]+1)%cells,(i[None,:]+1)%cells]
    return (a*(1-f[None,:])+b*f[None,:])*(1-f[:,None])+(c*(1-f[None,:])+d*f[None,:])*f[:,None]

def pbr_texture_set(name,dark,light,rough_base,seed,size=1024,kind='food'):
    rng=np.random.default_rng(int(seed*1000))
    yy,xx=np.mgrid[0:size,0:size].astype(np.float32)/size
    low=field(rng,size,7);mid=field(rng,size,37);fine=field(rng,size,173)
    grain=rng.random((size,size)).astype(np.float32)
    pores=np.zeros((size,size),dtype=np.float32)
    # Rounded random cavities with real rims, distributed across multiple scales.
    for k in range(2600 if kind!='berry' else 1400):
        x,y=rng.integers(0,size,2);rad=float(rng.uniform(.8,5.0 if kind=='cream' else 3.5))
        reach=int(rad*3)+1
        gy,gx=np.mgrid[-reach:reach+1,-reach:reach+1]
        d=(gx*gx+(gy*rng.uniform(.6,1.6))**2)/(rad*rad)
        stamp=-np.exp(-d*1.8)+.15*np.exp(-(np.sqrt(d)-1.25)**2*12)
        iy=(y+gy[:,0])%size;ix=(x+gx[0,:])%size
        pores[np.ix_(iy,ix)]+=stamp.astype(np.float32)*rng.uniform(.4,1)
    if kind=='berry':
        # Fine wax grains over dark skin, not large pale stone-like islands.
        rubbed=np.clip((low*.3+mid*.7-.52)*3,0,1)
        bloom=np.clip(.32-rubbed*.22+(fine-.5)*.22+(grain-.5)*.10,.03,.55)
        mix=bloom
        height=(fine-.5)*.002+pores*.002
        rough=.40+bloom*.55+(fine-.5)*.09
        slope=38
    elif kind=='cream':
        # Palette-knife passes overlap; each has a soft belly and a raised lip.
        swipe=np.zeros_like(low);tint=np.zeros_like(low)
        for k in range(16):
            cx,cy=rng.random(2);angle=rng.uniform(-.8,.8)
            dx=(xx-cx+.5)%1-.5;dy=(yy-cy+.5)%1-.5
            u=dx*np.cos(angle)-dy*np.sin(angle);v=dx*np.sin(angle)+dy*np.cos(angle)
            length=rng.uniform(.16,.29);width=rng.uniform(.045,.10)
            bend=v+.20*u*u/length
            radius=(u/length)**2+(bend/width)**2
            belly=np.exp(-radius*2.5)
            lip=np.exp(-((np.sqrt(radius)-.94)/.065)**2)*np.clip((bend/width+.4),0,1)
            swipe+=lip*.035-belly*.007
            tint+=belly*rng.uniform(.10,.45)+lip*.08
        mix=np.clip(tint+(mid-.5)*.035,0,.65)
        height=swipe+(fine-.5)*.008+pores*.037+(grain-.5)*.003
        rough=rough_base+(mid-.5)*.09+np.clip(-pores,0,1)*.08
        slope=19
    elif kind=='cocoa':
        # Cocoa grains and shallow scraper marks interrupt wide specular bands.
        powder=np.clip((fine-.46)*2.8,0,1)
        scrape=np.sin(yy*size*.48+mid*2.0)*(0.25+low*.75)
        mix=np.clip(.32+(mid-.5)*.14+powder*.13,0,1)
        height=(fine-.5)*.021+pores*.024+scrape*.0015+(grain-.5)*.009
        rough=rough_base+powder*.13+(mid-.5)*.12
        slope=24
    else:
        mix=.40+(mid-.5)*.13+(fine-.5)*.11
        height=(fine-.5)*.009+pores*.016+(grain-.5)*.006
        rough=rough_base+(mid-.5)*.10+(fine-.5)*.08+np.clip(-pores,0,1)*.08
        slope=22
    base=np.empty((size,size,4),dtype=np.float32)
    for i in range(3):
        base[:,:,i]=(dark[i]*(1-mix)+light[i]*mix)*(1+np.clip(pores,-1,0)*(.10 if kind=='cream' else .025))
    base[:,:,3]=1
    r=np.ones_like(base);r[:,:,:3]=np.clip(rough,.12,.92)[:,:,None]
    dx=(np.roll(height,1,axis=1)-np.roll(height,-1,axis=1))*slope
    dy=(np.roll(height,1,axis=0)-np.roll(height,-1,axis=0))*slope
    length=np.sqrt(dx*dx+dy*dy+1)
    normal=np.ones_like(base)
    normal[:,:,0]=dx/length*.5+.5;normal[:,:,1]=dy/length*.5+.5;normal[:,:,2]=1/length*.5+.5
    result=[]
    for suffix,pixels,space in [('basecolor',base,'sRGB'),('roughness',r,'Non-Color'),('normal',normal,'Non-Color')]:
        im=bpy.data.images.new(name+'_'+suffix,width=size,height=size,alpha=False)
        im.colorspace_settings.name=space
        im.pixels.foreach_set(pixels.ravel());im.pack();result.append(im)
    return tuple(result)

def frosted_body(mat,mesh_fn,theme):
    """Continuous side and top with small hand-tool ridges, no lathed lid."""
    n=384;nz=100;nr=70;vs=[];fs=[];uvs=[]
    rng=np.random.default_rng(9206)
    strokes=[(float(rng.uniform(0,2*pi)),float(rng.uniform(.08,.92)),float(rng.uniform(.28,.68)),float(rng.uniform(.10,.25)),float(rng.uniform(-.38,.38))) for _ in range(27)]
    top_strokes=[(float(rng.uniform(-.82,.82)),float(rng.uniform(-.82,.82)),float(rng.uniform(-pi,pi)),float(rng.uniform(.32,.66)),float(rng.uniform(.10,.23))) for _ in range(16)]
    def n3(x,y,z,scale):return noise.noise_vector(Vector((x*scale,y*scale,z*scale)))[0]
    for j in range(nz+1):
        t=j/nz;z=.11+t*1.125
        for k in range(n):
            a=2*pi*k/n;x,y=cos(a),sin(a)
            tool=t*8+.16*sin(a*2)+.06*sin(a*7+t*4)
            ridge=exp(-(sin(tool*pi)/.09)**2)
            radial=.003*ridge+.002*n3(x,y,z,17)+.003*n3(x,y,z,4)
            if theme=='blueberry':radial=.004*n3(x,y,z,17)+.008*n3(x,y,z,3)
            # Local palette-knife passes alter the silhouette. Each has a soft
            # belly, a raised leading lip and a feathered exit.
            strength={'chocolate':.010,'blueberry':.018,'redvelvet':.012}[theme]
            for center,level,length,width,tilt in strokes:
                delta=(a-center+pi)%(2*pi)-pi
                u=delta/length;v=(t-level-tilt*delta)/width
                radius=(u*u+v*v)**.5
                if radius<1.4:
                    radial+=strength*exp(-((radius-.86)/.10)**2)*max(0,min(1,v+.65))+strength*.28*exp(-radius*radius*2)
            r=1.4+radial
            if j==0:r-=.018
            if j==nz:r-=.012
            zz=z+(.006*sin(a*11)+.003*sin(a*23))*t**14
            vs.append((r*x,r*y,zz));uvs.append((k/n*3,t))
    for j in range(nz):
        for k in range(n):
            a=j*n+k;b=j*n+(k+1)%n;fs.append((a,b,b+n,a+n))
    # Reuse outer boundary; top has real shallow hand-spread contours.
    last=nz*n
    for ring in range(1,nr+1):
        r=1.388*(1-ring/nr)
        start=len(vs)
        for k in range(n):
            a=2*pi*k/n;x,y=r*cos(a),r*sin(a)
            spread=r*11+.3*sin(a*3)+.18*n3(x,y,1,3)
            z=1.235+.0016*n3(x,y,1,30)+.002*n3(x,y,1,6)+.003*exp(-(sin(spread*pi)/.15)**2)
            for cx,cy,angle,length,width in top_strokes:
                dx=x-cx;dy=y-cy
                u=(dx*cos(angle)+dy*sin(angle))/length
                v=(-dx*sin(angle)+dy*cos(angle))/width
                radius=(u*u+v*v)**.5
                if radius<1.35:
                    top_strength=.006 if theme=='chocolate' else .009
                    z+=top_strength*exp(-((radius-.88)/.11)**2)*max(0,min(1,v+.60))-top_strength*.18*exp(-radius*radius*1.8)
            vs.append((x,y,z));uvs.append((1+x/1.5,1+y/1.5))
        for k in range(n):fs.append((last+k,last+(k+1)%n,start+(k+1)%n,start+k))
        last=start
    obj=mesh_fn('hand_spread_frosting',vs,fs,mat)
    uv=obj.data.uv_layers.new(name='UVMap')
    for face in obj.data.polygons:
        coords=[uvs[obj.data.loops[i].vertex_index] for i in face.loop_indices]
        if face.index<nz*n and max(c[0] for c in coords)-min(c[0] for c in coords)>1.5:
            coords=[(u+3 if u<1.5 else u,v) for u,v in coords]
        for li,c in zip(face.loop_indices,coords):uv.data[li].uv=c
    return obj
