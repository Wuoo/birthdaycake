"""Original procedural patisserie assets. Blender 5.2 -> glTF for Three.js.
All dimensions in decimeters; z-up authoring, glTF y-up delivery.
Rebuild: blender -b --python assets-src/build_cakes.py
"""
import bpy, bmesh, math, random, os, sys
from array import array
from mathutils import Vector, noise as mnoise
from mathutils.bvhtree import BVHTree
from math import sin, cos, pi, sqrt, exp
random.seed(1126)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from patisserie_surfaces import pbr_texture_set, frosted_body
OUT=os.path.join(ROOT,"outputs","cake-v2","models")
SCENE_OUT=os.path.join(ROOT,"scene","v2")
os.makedirs(SCENE_OUT,exist_ok=True)
os.makedirs(OUT,exist_ok=True)
os.makedirs(os.path.join(ROOT,"scene"),exist_ok=True)

CAKE_SUPPORT=None

def settle_on_frosting(objects):
    """Seat a rigid decoration against the actual frosting, after rotation.

    Test the entire underside, not the unrotated radius or object origin.
    A 0.3 mm embed represents soft frosting yielding under the decoration.
    """
    bpy.context.view_layer.update()
    gaps=[]
    for obj in objects:
        for v in obj.data.vertices:
            p=obj.matrix_world @ v.co
            hit=CAKE_SUPPORT.ray_cast(Vector((p.x,p.y,3)),Vector((0,0,-1)))
            if hit[0] is not None:gaps.append(p.z-hit[0].z)
    if not gaps:raise RuntimeError('Decoration has no supporting cake surface')
    shift=min(gaps)+.003
    for obj in objects:obj.location.z-=shift
    print('SEATED',objects[0].name,'previous_gap',round(min(gaps),6),'final_gap',-.003,flush=True)

def material(name,color,rough=.5,metal=0,coat=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes.clear()
    p=m.node_tree.nodes.new("ShaderNodeBsdfPrincipled");p.name="Principled BSDF"
    output=m.node_tree.nodes.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(p.outputs["BSDF"],output.inputs["Surface"])
    p.inputs["Base Color"].default_value=(*color,1)
    p.inputs["Roughness"].default_value=rough
    p.inputs["Metallic"].default_value=metal
    p.inputs["Coat Weight"].default_value=coat
    p.inputs["Coat Roughness"].default_value=.15
    return m

def tileable_noise(x,y,seed=0):
    # Deterministic multi-scale surface variation; periodic so the UV seam disappears.
    return (.50+.22*sin(2*pi*x*3+seed+.7*sin(2*pi*y*2))
            +.13*sin(2*pi*(x*11+y*7)+seed*1.7)
            +.08*sin(2*pi*(x*31-y*23)+seed*.37))

def legacy_pbr_texture_set(name,dark,light,rough_base,seed,size=512,kind="food"):
    heights=[0.0]*(size*size)
    masks=[0.0]*(size*size)
    for y in range(size):
        v=y/size
        for x in range(size):
            u=x/size
            # Noise sampled around a cylinder is periodic at its seam.
            p=Vector((cos(u*2*pi)*2.4,sin(u*2*pi)*2.4,v*7+seed))
            n=mnoise.noise_vector(p)[0]
            fine=mnoise.noise_vector(p*19)[1]
            pore=max(0,mnoise.noise_vector(p*47)[2]-.38)*.3
            masks[y*size+x]=max(0,min(1,.5+n*1.35))
            stroke=sin(v*91+n*2.2+sin(u*2*pi*3))
            if kind=="cream":
                heights[y*size+x]=stroke*.035+fine*.07-pore
            elif kind=="berry":
                heights[y*size+x]=fine*.035-pore*.2
            else:
                heights[y*size+x]=stroke*.025+fine*.05-pore*.4
    def make_image(suffix,colorspace):
        im=bpy.data.images.new(f"{name}_{suffix}",width=size,height=size,alpha=False)
        im.colorspace_settings.name=colorspace;im.pack();return im
    albedo=make_image("basecolor","sRGB");rough=make_image("roughness","Non-Color");normal=make_image("normal","Non-Color")
    ap=array('f');rp=array('f');np=array('f')
    for y in range(size):
        for x in range(size):
            h=heights[y*size+x];m=masks[y*size+x]
            if kind=="cream":
                # Delicate folded traces, not broad camouflage patches.
                m=max(0,1-abs(sin(y/size*24+m*5+x/size*9))/.17)*.48
            c=tuple(dark[i]*(1-m)+light[i]*m for i in range(3));ap.extend((*c,1))
            r=max(.08,min(.95,rough_base+(m-.5)*(.22 if kind=="berry" else .12)));rp.extend((r,r,r,1))
            hl=heights[y*size+(x-1)%size];hr=heights[y*size+(x+1)%size]
            hd=heights[((y-1)%size)*size+x];hu=heights[((y+1)%size)*size+x]
            nx=(hl-hr)*1.8;ny=(hd-hu)*1.8;nz=1.0;l=sqrt(nx*nx+ny*ny+nz*nz)
            np.extend((nx/l*.5+.5,ny/l*.5+.5,nz/l*.5+.5,1))
    albedo.pixels.foreach_set(ap);rough.pixels.foreach_set(rp);normal.pixels.foreach_set(np)
    for im in (albedo,rough,normal):im.pack()
    return albedo,rough,normal

def attach_pbr(mat,images,normal_strength=.36):
    nt=mat.node_tree;bsdf=nt.nodes.get("Principled BSDF")
    base=nt.nodes.new("ShaderNodeTexImage");base.image=images[0];base.interpolation="Linear"
    rgh=nt.nodes.new("ShaderNodeTexImage");rgh.image=images[1];rgh.image.colorspace_settings.name="Non-Color"
    nrm=nt.nodes.new("ShaderNodeTexImage");nrm.image=images[2];nrm.image.colorspace_settings.name="Non-Color"
    normal=nt.nodes.new("ShaderNodeNormalMap");normal.inputs["Strength"].default_value=normal_strength
    nt.links.new(base.outputs["Color"],bsdf.inputs["Base Color"]);nt.links.new(rgh.outputs["Color"],bsdf.inputs["Roughness"])
    nt.links.new(nrm.outputs["Color"],normal.inputs["Color"]);nt.links.new(normal.outputs["Normal"],bsdf.inputs["Normal"])

def mesh(name,vs,fs,mat,colors=None):
    data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for f in data.polygons:f.use_smooth=True
    if colors:
        a=data.color_attributes.new(name="Color",type="FLOAT_COLOR",domain="POINT")
        for i,c in enumerate(colors):a.data[i].color=(*c,1)
    return obj

def vertex_material(name,rough,coat=0):
    m=material(name,(1,1,1),rough,coat=coat)
    n=m.node_tree.nodes.new("ShaderNodeVertexColor");n.layer_name="Color"
    m.node_tree.links.new(n.outputs["Color"],m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    return m

def sphere(name,loc,scale,mat,rings=16,segments=24,berry=False,nut=False,cherry=False,phase=0):
    vs=[];fs=[];colors=[]
    is_crumb='crumb' in name
    for j in range(rings+1):
        t=pi*j/rings
        for i in range(segments):
            a=2*pi*i/segments
            q=1+(.009 if berry else .012)*sin(7*a+3*t+phase)+(.012*sin(13*a+phase)*sin(t) if nut else 0)
            if is_crumb:q*=.72+.48*random.random()
            if cherry:q+=.024*sin(5*a+2.7*t+phase)+.009*sin(11*a-4*t+phase*.4)
            r=sin(t)*q
            z=cos(t)
            if berry:z-=.35*math.exp(-t*t/.16)
            if nut:
                r*=1-.09*max(0,cos(t)-.32)
                z=max(-.84,z+.045*cos(t)**3)
            if cherry:z-=.075*math.exp(-t*t/.10)
            vs.append((r*cos(a)*scale[0],r*sin(a)*scale[1],z*scale[2]))
            if berry:
                # Mild instance variation; the PBR maps carry the wax bloom.
                v=.92+.07*sin(phase)
                colors.append((v,v,v))
            elif nut:
                k=.65+.16*sin(a*13+t*7+phase)+.07*sin(a*25-phase)
                fissure=abs(sin(a*2.7+t*3.4+sin(a*5)*.35))
                if fissure<.055:k*=.38
                colors.append((.14*k,.045*k,.014*k))
            elif cherry:
                # Dark red skin with subtle natural mottling; highlight remains dynamic.
                k=.52+.13*sin(a*5+t*3+phase)+.065*sin(a*17-t*9+phase*.7)
                colors.append((.052*k,.0015*k,.003*k))
    for j in range(rings):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            fs.append((a,a+segments,b+segments,b))
    o=mesh(name,vs,fs,mat,colors or None);o.location=loc
    if is_crumb:
        for p in o.data.polygons:p.use_smooth=False
    uv=o.data.uv_layers.new(name="UVMap")
    for polygon in o.data.polygons:
        ids=[o.data.loops[li].vertex_index for li in polygon.loop_indices]
        seam=any(idx%segments==0 for idx in ids) and any(idx%segments==segments-1 for idx in ids)
        for li,idx in zip(polygon.loop_indices,ids):
            u=(idx%segments)/segments
            if seam and u==0:u=1
            uv.data[li].uv=(u,(idx//segments)/rings)
    return o

def lathe(name,profile,mat,segments=192,noise=0,cream=False):
    vs=[];fs=[]
    for j,(r,z) in enumerate(profile):
        for i in range(segments):
            a=2*pi*i/segments
            dr=noise*(sin(13*a+z*19)*.5+sin(37*a-z*22)*.3+sin(7*a)*.2)
            if cream:dr+=.0025*sin(z*105+sin(a*3)*.7)
            vs.append(((r+dr)*cos(a),(r+dr)*sin(a),z))
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            fs.append((a,b,b+segments,a+segments))
    o=mesh(name,vs,fs,mat)
    food_uv(o)
    # Horizontal caps must stay planar. Smooth radial cap normals create metallic
    # looking fan-shaped highlights on dark food materials.
    for p in o.data.polygons:
        if abs(p.normal.z)>.82:p.use_smooth=False
    return o

def curve(name,coords,thick,mat):
    cu=bpy.data.curves.new(name,"CURVE");cu.dimensions="3D";cu.bevel_depth=thick;cu.bevel_resolution=2;cu.resolution_u=8
    sp=cu.splines.new("POLY");sp.points.add(len(coords)-1)
    for p,v in zip(sp.points,coords):p.co=(*v,1)
    ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);cu.materials.append(mat)
    return ob

def food_uv(obj):
    uv=obj.data.uv_layers.get("UVMap") or obj.data.uv_layers.new(name="UVMap")
    for poly in obj.data.polygons:
        raw=[]
        for li in poly.loop_indices:
            co=obj.data.vertices[obj.data.loops[li].vertex_index].co
            if abs(poly.normal.z)>.82:raw.append((.5+co.x/3.0,.5+co.y/3.0))
            else:raw.append(((math.atan2(co.y,co.x)/(2*pi))%1,(co.z-.08)/1.28))
        if raw and max(u for u,v in raw)-min(u for u,v in raw)>.5:
            raw=[(u+1 if u<.5 else u,v) for u,v in raw]
        for li,coord in zip(poly.loop_indices,raw):uv.data[li].uv=coord

def petal(loc,angle,size,mat):
    vs=[];fs=[];nu=18;nv=10
    # Thick spoon-drawn buttercream petal. Slight piping striations.
    for side in (0,1):
        for u in range(nu+1):
            t=u/nu;w=.16*sin(pi*t)**.6*size
            for v in range(nv+1):
                s=v/nv*2-1
                x=t*.48*size;y=w*s
                z=.035+.11*sin(pi*t)**.7*(1-.7*s*s)+.004*sin(v*2.5+t*12)
                if side:z=-.018
                vs.append((loc[0]+cos(angle)*x-sin(angle)*y,loc[1]+sin(angle)*x+cos(angle)*y,loc[2]+z))
    count=(nu+1)*(nv+1)
    for side in (0,1):
        off=side*count
        for u in range(nu):
            for v in range(nv):
                a=off+u*(nv+1)+v;f=(a,a+1,a+nv+2,a+nv+1)
                fs.append(tuple(reversed(f)) if not side else f)
    for u in range(nu):
        for v in (0,nv):
            a=u*(nv+1)+v;b=(u+1)*(nv+1)+v
            fs.append((a,b,b+count,a+count))
    return mesh("hand_piped_petal",vs,fs,mat)

def ribbon(loc,angle,mat,seed):
    rng=random.Random(seed);vs=[];fs=[]
    length=rng.uniform(.52,.90);turn=rng.uniform(2.5,4.2)
    for i in range(40):
        t=i/39;theta=t*turn
        for j in range(5):
            v=j/4-.5
            x=.235*cos(theta)+t*.34;y=v*.29+sin(t*5)*.038;z=.215*sin(theta)+.23+t*.13
            vs.append((loc[0]+cos(angle)*x-sin(angle)*y,loc[1]+sin(angle)*x+cos(angle)*y,loc[2]+z))
    for i in range(39):
        for j in range(4):
            a=i*5+j;fs.append((a,a+1,a+6,a+5))
    lowest=min(v[2] for v in vs)
    vs=[(x,y,z-lowest+loc[2]+.005) for x,y,z in vs]
    o=mesh("tempered_chocolate_curl",vs,fs,mat)
    uv=o.data.uv_layers.new(name='UVMap')
    for p in o.data.polygons:
        for li in p.loop_indices:
            idx=o.data.loops[li].vertex_index;uv.data[li].uv=((idx//5)/39,(idx%5)/4)
    mod=o.modifiers.new("thin chocolate","SOLIDIFY");mod.thickness=.003
    settle_on_frosting([o])
    return o

def chocolate_shard(loc,angle,mat,seed,ivory=False):
    rng=random.Random(seed);vs=[];fs=[];nu=48;nv=12
    length=rng.uniform(.40,.64);width=rng.uniform(.20,.34)
    for i in range(nu+1):
        t=i/nu
        for j in range(nv+1):
            s=j/nv*2-1
            w=width*(.65+.35*sin(pi*t))*(1-.8*t**4)
            x=length*t;y=s*w*.5
            z=.035+.30*t+.12*sin(t*pi)*s+.08*sin(t*3.1+seed)*t+.012*sin(s*5+t*8)*t
            vs.append((loc[0]+cos(angle)*x-sin(angle)*y,loc[1]+sin(angle)*x+cos(angle)*y,loc[2]+z))
    for i in range(nu):
        for j in range(nv):
            a=i*(nv+1)+j;fs.append((a,a+1,a+nv+2,a+nv+1))
    o=mesh('hand_shaved_chocolate',vs,fs,mat)
    uv=o.data.uv_layers.new(name='UVMap')
    for p in o.data.polygons:
        for li in p.loop_indices:
            idx=o.data.loops[li].vertex_index;uv.data[li].uv=((idx//(nv+1))/nu,(idx%(nv+1))/nv)
    mod=o.modifiers.new('edible thin edge','SOLIDIFY');mod.thickness=.0035
    settle_on_frosting([o])
    return o

def crown(name,loc,radius,mat,points=5):
    vs=[(0,0,.012)]
    for j in range(points*2):
        a=j*pi/points;r=radius if j%2==0 else radius*.43
        vs.append((cos(a)*r,sin(a)*r,0 if j%2==0 else -.014))
    o=mesh(name,vs,[(0,j+1,(j+1)%(points*2)+1) for j in range(points*2)],mat)
    o.location=loc;return o

def cream_dollop(loc,angle,mat,scale=1):
    vs=[];fs=[];nr=25;ns=64
    for j in range(nr+1):
        t=j/nr
        for k in range(ns):
            a=2*pi*k/ns
            radius=.16*(1-t)**.58*(1+.20*cos(8*(a-t*2.0-angle)))
            vs.append((loc[0]+scale*(radius*cos(a)+.05*t*t),loc[1]+scale*radius*sin(a),loc[2]+scale*.27*t))
    for j in range(nr):
        for k in range(ns):
            a=j*ns+k;b=j*ns+(k+1)%ns;fs.append((a,b,b+ns,a+ns))
    o=mesh("piped_cream_rosette",vs,fs,mat)
    uv=o.data.uv_layers.new(name='UVMap')
    for p in o.data.polygons:
        for li in p.loop_indices:
            idx=o.data.loops[li].vertex_index;uv.data[li].uv=((idx%ns)/ns,(idx//ns)/nr)

def nut_half(loc,angle,skin,kernel):
    vs=[];fs=[];ns=40;nr=12
    for j in range(nr+1):
        t=j/nr*pi/2
        for k in range(ns):
            a=k*2*pi/ns;r=.10*sin(t)*(1+.035*sin(a*7+angle))
            vs.append((r*cos(a),r*sin(a),-.08*cos(t)))
    for j in range(nr):
        for k in range(ns):
            a=j*ns+k;b=j*ns+(k+1)%ns;fs.append((a,b,b+ns,a+ns))
    shell=mesh('cut_hazelnut_skin',vs,fs,skin)
    # Skin material uses vertex colors in whole nuts; provide equivalent colors.
    col=shell.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for k,v in enumerate(col.data):v.color=(.15+.035*sin(k),.065,.020,1)
    vs=[];fs=[]
    for j in range(13):
        rr=j/12*.096
        for k in range(ns):
            a=k*2*pi/ns
            z=.001+.003*sin(a*5+rr*90)-.009*exp(-rr*rr/.0005)
            vs.append((rr*cos(a),rr*sin(a),z))
    for j in range(12):
        for k in range(ns):
            a=j*ns+k;b=j*ns+(k+1)%ns;fs.append((a,b,b+ns,a+ns))
    cut=mesh('hazelnut_cut_face',vs,fs,kernel)
    for obj in (shell,cut):
        obj.location=loc;obj.rotation_euler=(.42*cos(angle),.42*sin(angle),angle)
        uv=obj.data.uv_layers.new(name='UVMap')
        for p in obj.data.polygons:
            for li in p.loop_indices:
                v=obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv=(.5+v.x/.21,.5+v.y/.21)
    settle_on_frosting([shell,cut])

def berry_calyx(loc,s,mat,phase):
    vs=[];fs=[];n=50
    for ring in range(3):
        for k in range(n):
            a=k*2*pi/n;lobes=(.5+.5*cos(a*5+phase))**2
            r=s*(.12 if ring==0 else .23 if ring==1 else .25+.13*lobes)
            z=s*(-.048 if ring==0 else .018 if ring==1 else .08*lobes)
            vs.append((r*cos(a),r*sin(a),z))
    for ring in range(2):
        for k in range(n):
            a=ring*n+k;b=ring*n+(k+1)%n;fs.append((a,b,b+n,a+n))
    fs.append(tuple(reversed(range(n))))
    o=mesh("recessed_five_lobe_calyx",vs,fs,mat);o.location=loc;return o

def build(theme):
    global CAKE_SUPPORT
    random.seed({"chocolate":1126,"blueberry":2207,"redvelvet":3319}[theme])
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    chocolate=theme=="chocolate";blueberry=theme=="blueberry"
    names={"chocolate":("ganache","glaze"),"blueberry":("buttercream","cream_petals"),"redvelvet":("red_velvet_crumb","cream_cheese")}
    base_colors={"chocolate":((.028,.009,.004),.42,.10),"blueberry":((.78,.68,.55),.54,0),"redvelvet":((.78,.68,.55),.58,0)}
    top_colors={"chocolate":((.027,.007,.003),.29,.20),"blueberry":((.78,.68,.55),.54,0),"redvelvet":((.78,.68,.55),.58,0)}
    bc,br,bcoat=base_colors[theme];tc,tr,tcoat=top_colors[theme]
    base=material(names[theme][0],bc,br,coat=bcoat)
    top=material(names[theme][1],tc,tr,coat=tcoat)
    if not chocolate:
        cream_maps=pbr_texture_set(theme+"_cream",(.84,.78,.69),(.62,.53,.64) if blueberry else (.88,.81,.70),.48,8.3,size=2048,kind="cream")
        attach_pbr(base,cream_maps,.85)
        attach_pbr(top,cream_maps,.70)
    board=material("charcoal_ceramic",(.027,.026,.025),.32,coat=.2)
    crumb_names={"chocolate":"cocoa_crumb","blueberry":"rose_fleck","redvelvet":"velvet_crumb"}
    crumb_colors={"chocolate":(.09,.031,.012),"blueberry":(.18,.018,.053),"redvelvet":(.115,.002,.007)}
    crumb=material(crumb_names[theme],crumb_colors[theme],.85)
    lathe("serving_plate",[(0,0),(1.62,0),(1.69,.03),(1.71,.055),(1.69,.08),(1.53,.095),(0,.095)],board)
    profile=[(0,.105),(1.31,.105),(1.382,.132)]
    for j in range(65):
        hand_variation=.009*sin(j*.17)+.004*sin(j*.61)+(.003 if j%11<3 else -.002)
        profile.append((1.402+hand_variation,.16+j*.016))
    profile.extend([(1.392,1.2),(1.355,1.23),(0,1.23)])
    body=frosted_body(base,mesh,theme)
    CAKE_SUPPORT=BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons])
    if chocolate:
        chocolate_maps=pbr_texture_set("dark_ganache",(.15,.075,.040),(.24,.12,.062),.49,3.1)
        attach_pbr(base,chocolate_maps,.8)
        attach_pbr(top,pbr_texture_set("ganache_top",(.12,.057,.029),(.20,.090,.045),.39,5.1),.55)
        # The broad top stays uniform; its wetness is expressed by live reflection.
        # Large baked color variation reads as a false spotlight on this flat surface.
        # Continuous hand-spread frosting avoids a separate hard plastic lid.
        nutmat=vertex_material("roasted_hazelnut",.72)
        cherry=vertex_material("amarena_cherry",.34,coat=.34)
        curls=material("chocolate_ribbon",(.12,.045,.021),.37)
        attach_pbr(curls,pbr_texture_set("cocoa_ribbon",(.11,.045,.020),(.21,.095,.039),.53,10.2,kind="cocoa"),.90)
        kernel=material("hazelnut_kernel",(.70,.48,.25),.65)
        attach_pbr(kernel,pbr_texture_set("nut_cut",(.65,.44,.23),(.86,.70,.46),.64,4.2,size=256),.22)
        stemmat=material("cherry_stem",(.025,.018,.008),.76)
        gold=material("edible_gold",(.82,.52,.16),.24,metal=1)
        # An asymmetric crescent leaves quiet negative space around the candles.
        for k in range(34):
            a=-2.65+k/33*5.6+random.uniform(-.045,.045);r=(1.15 if k%2 else .78)+random.uniform(-.045,.045)
            if k%3==0:
                nut_half((r*cos(a),r*sin(a),1.29),a,nutmat,kernel)
                continue
            o=sphere("hazelnut",(r*cos(a),r*sin(a),1.32),(.095,.09,.105),nutmat,nut=True,phase=k*.71)
            o.rotation_euler=(random.random()*pi,random.random()*pi,a)
            settle_on_frosting([o])
        for k in range(7):
            a=-2.45+k/6*5.4+random.uniform(-.06,.06);r=1.08+random.random()*.07
            x,y,z=r*cos(a),r*sin(a),1.39+random.uniform(-.01,.07)
            s=random.uniform(.90,1.08)
            o=sphere("glossy_cherry",(x,y,z),(.14*s,.135*s,.13*random.uniform(.90,1.08)),cherry,cherry=True,phase=k*1.37)
            o.rotation_euler=(random.uniform(-.16,.16),random.uniform(-.16,.16),random.random()*pi)
            settle_on_frosting([o])
            z=o.location.z
            if k%3!=1:
                bend=.045*(-1 if k%2 else 1)
                curve("cherry_stem",[(x,y,z+.112),(x+bend,y+.01,z+.21),(x+bend*.4,y+.025,z+.29)],.009,stemmat)
        for k in range(12):
            a=-2.4+k/12*2*pi;r=.78+random.random()*.10
            if k%2:chocolate_shard((r*cos(a),r*sin(a),1.235),a+1.5,curls,k+40)
            else:ribbon((r*cos(a),r*sin(a),1.235),a+1.8,curls,k)
        for k in range(0):
            a=-2.55+k/7*4.15+random.uniform(-.16,.16);r=1.405
            length=random.uniform(.10,.30)
            width=random.uniform(.032,.060)
            sphere("ganache_drip",(r*cos(a),r*sin(a),1.12-length*.5),(width,width*random.uniform(.76,1.05),length),top,rings=12,segments=16)
            # A thicker shoulder explains where each gravity-driven drip begins.
            sphere("ganache_drip",(r*cos(a),r*sin(a),1.145),(width*1.35,width*1.15,.045),top,rings=9,segments=14)
        for k in range(48):
            a=random.random()*2*pi;r=random.uniform(.66,1.28)
            x,y=r*cos(a),r*sin(a);s=random.uniform(.018,.062)
            mesh("gold_leaf",[(x,y,1.244),(x+s,y+.01,1.25),(x+s*.8,y+s,1.26),(x-.01,y+s*.7,1.247),(x+s*.4,y+s*.45,1.275)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],gold)
        for k in range(680):
            a=random.random()*2*pi;r=random.uniform(.68,1.28);s=random.uniform(.009,.032)
            sphere("chocolate_top_crumb",(r*cos(a),r*sin(a),1.245+s*.35),(s,s*.67,s*.45),crumb,rings=5,segments=6)
    elif blueberry:
        berry=material("blueberry_bloom",(.055,.070,.115),.59,coat=.045)
        attach_pbr(berry,pbr_texture_set("blueberry_wax",(.035,.050,.085),(.22,.25,.33),.71,2.6,kind="berry"),.72)
        calyx=material("blueberry_calyx",(.006,.009,.016),.85)
        ivory=material("ivory_chocolate",(.83,.74,.57),.42)
        jam=material("blueberry_compote",(.065,.005,.028),.22,coat=.3)
        # Two staggered arcs form an original asymmetric crescent.
        for ring,n in ((1.15,13),(.91,11),(.68,7)):
            for k in range(n):
                a=1.95+k/(n-1)*2.75+(0 if n==13 else .10);r=ring+random.uniform(-.025,.025)
                s=random.uniform(.125,.16);z=1.235+s*.86
                pos=(r*cos(a),r*sin(a),z)
                o=sphere("blueberry",pos,(s,s*.96,s*.88),berry,berry=True,rings=24,segments=40,phase=k*1.71)
                c=berry_calyx((pos[0],pos[1],z+s*.69),s,calyx,k*.31)
                c.parent=o;c.location=(0,0,s*.69)
                o.rotation_euler=(random.uniform(-.35,.35),random.uniform(-.35,.35),k*1.1)
                settle_on_frosting([o])
        for k in range(9):
            a=1.90+k*.35;r=.51 if k%2 else 1.23
            cream_dollop((r*cos(a),r*sin(a),1.23),a,top,random.uniform(.65,1.05))
        for k in range(6):
            a=2.10+k*.48;r=.82
            chocolate_shard((r*cos(a),r*sin(a),1.21),a+1.8,ivory,k+12,True)
        for k in range(100):
            a=random.uniform(1.90,4.85);r=random.uniform(.53,1.29);s=random.uniform(.012,.055)
            sphere("compote",(r*cos(a),r*sin(a),1.239),(s,s*.7,.008),jam,rings=6,segments=12)
    else:
        dollop_mat=material("piped_cream_cheese",(.83,.74,.63),.64)
        for z in ():
            lathe("cream_cheese_layer",[(0,z-.028),(1.392,z-.028),(1.425,z),(1.392,z+.035),(0,z+.035)],top,segments=160,noise=.003,cream=True)
        attach_pbr(dollop_mat,cream_maps,.65)
        ivory=material("white_chocolate_shard",(.83,.74,.57),.42)
        for k in range(10):
            a=.20+k/10*2*pi
            r=1.06;cream_dollop((r*cos(a),r*sin(a),1.235),a,dollop_mat,random.uniform(1.05,1.20))
        for k in range(3):
            a=.8+k*.4;r=.82
            chocolate_shard((r*cos(a),r*sin(a),1.235),a+1.7,ivory,k+21,True)
        for k in range(900):
            a=random.random()*2*pi;r=random.uniform(.91,1.25);s=random.uniform(.007,.023)
            sphere("velvet_top_crumb",(r*cos(a),r*sin(a),1.245+random.uniform(0,.018)),(s,s*.8,s*.65),crumb,rings=4,segments=5)
    # Surface freckles and crumbs deliberately non-uniform.
    for k in range(850 if chocolate else 0 if blueberry else 4200):
        a=random.random()*2*pi;z=.13+random.random()**1.4*(.19 if chocolate else .30+.05*sin(a*9))
        r=1.402;s=random.uniform(.010,.035) if chocolate else random.uniform(.008,.023)
        o=sphere("cocoa_crumb" if chocolate else "velvet_sponge_crumb",(r*cos(a),r*sin(a),z),(s,s*.7,s*.8),crumb,rings=4,segments=5)
        o.rotation_euler[2]=a
    # Consolidate by material to keep browser draw calls bounded.
    bpy.context.view_layer.update()
    for ob in list(bpy.context.scene.objects):
        if ob.parent:
            world=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=world
        if ob.type=="MESH" and not ob.data.uv_layers:food_uv(ob)
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.convert(target="MESH")
    # Ensure closed food surfaces face outward; area-weighted consistency on open curls.
    for obj in list(bpy.context.selected_objects):
        if obj.type!="MESH":continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data);bm.free()
    mats={}
    for ob in list(bpy.context.scene.objects):
        if ob.type=="MESH":mats.setdefault(ob.data.materials[0].name,[]).append(ob)
    for name,objects in mats.items():
        bpy.ops.object.select_all(action="DESELECT")
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=name
        # One packed UV set lets glTF carry the baked PBR maps into Three.js.
        bpy.context.view_layer.objects.active=objects[0]
        if not objects[0].data.uv_layers:
            bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012)
            bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SCENE_OUT,theme+".blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,theme+".glb"),export_format="GLB",export_yup=True,export_apply=True,export_materials="EXPORT")
    print("EXPORTED",theme)

for requested_theme in os.environ.get("CAKE_THEMES","chocolate,blueberry,redvelvet").split(","):
    build(requested_theme.strip())
