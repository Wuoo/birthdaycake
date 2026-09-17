"""Original procedural patisserie assets. Blender 5.2 -> glTF for Three.js.
All dimensions in decimeters; z-up authoring, glTF y-up delivery.
Rebuild: blender -b --python assets-src/build_cakes.py
"""
import bpy, math, random, os
from array import array
from mathutils import Vector
from math import sin, cos, pi, sqrt
random.seed(1126)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,"public","models")
os.makedirs(OUT,exist_ok=True)
os.makedirs(os.path.join(ROOT,"scene"),exist_ok=True)

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

def pbr_texture_set(name,dark,light,rough_base,seed,size=512):
    heights=[0.0]*(size*size)
    for y in range(size):
        v=y/size
        for x in range(size):
            u=x/size;n=tileable_noise(u,v,seed)
            pores=max(0.0, sin((u*127+v*83+seed)*pi*2)-.92)*2.8
            heights[y*size+x]=n*.58-pores*.24
    def make_image(suffix,colorspace):
        im=bpy.data.images.new(f"{name}_{suffix}",width=size,height=size,alpha=False)
        im.colorspace_settings.name=colorspace;im.pack();return im
    albedo=make_image("basecolor","sRGB");rough=make_image("roughness","Non-Color");normal=make_image("normal","Non-Color")
    ap=array('f');rp=array('f');np=array('f')
    for y in range(size):
        for x in range(size):
            h=heights[y*size+x];m=max(0,min(1,.5+h*.42))
            c=tuple(dark[i]*(1-m)+light[i]*m for i in range(3));ap.extend((*c,1))
            r=max(.08,min(.95,rough_base-h*.12));rp.extend((r,r,r,1))
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
    for j in range(rings+1):
        t=pi*j/rings
        for i in range(segments):
            a=2*pi*i/segments
            q=1+(.004 if berry else .012)*sin(7*a+3*t+phase)+(.012*sin(13*a+phase)*sin(t) if nut else 0)
            if cherry:q+=.024*sin(5*a+2.7*t+phase)+.009*sin(11*a-4*t+phase*.4)
            r=sin(t)*q
            z=cos(t)
            if berry:z-=.17*math.exp(-t*t/.12)
            if nut:
                r*=1-.09*max(0,cos(t)-.32)
                z=max(-.84,z+.045*cos(t)**3)
            if cherry:z-=.075*math.exp(-t*t/.10)
            vs.append((r*cos(a)*scale[0],r*sin(a)*scale[1],z*scale[2]))
            if berry:
                frost=max(0,min(1,.52+.10*sin(17*a+sin(11*t))+.08*sin(33*t+8*a)))
                v=.035+frost*.11
                colors.append((v*.53,v*.65,v))
            elif nut:
                k=.65+.16*sin(a*13+t*7+phase)+.07*sin(a*25-phase)
                fissure=abs(sin(a*2.7+t*3.4+sin(a*5)*.35))
                if fissure<.055:k*=.38
                colors.append((.14*k,.045*k,.014*k))
            elif cherry:
                # Dark red skin with subtle natural mottling; highlight remains dynamic.
                k=.52+.13*sin(a*5+t*3+phase)+.065*sin(a*17-t*9+phase*.7)
                colors.append((.16*k,.0045*k,.009*k))
    for j in range(rings):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            fs.append((a,a+segments,b+segments,b))
    o=mesh(name,vs,fs,mat,colors or None);o.location=loc;return o

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
    length=rng.uniform(.6,1.1);turn=rng.uniform(2.7,4.6)
    for i in range(40):
        t=i/39;theta=t*turn
        for j in range(5):
            v=j/4-.5
            x=.18*cos(theta)+t*.31;y=v*.115+sin(t*5)*.045;z=.15*sin(theta)+.18+t*.11
            vs.append((loc[0]+cos(angle)*x-sin(angle)*y,loc[1]+sin(angle)*x+cos(angle)*y,loc[2]+z))
    for i in range(39):
        for j in range(4):
            a=i*5+j;fs.append((a,a+1,a+6,a+5))
    o=mesh("tempered_chocolate_curl",vs,fs,mat)
    mod=o.modifiers.new("thin chocolate","SOLIDIFY");mod.thickness=.003
    return o

def crown(name,loc,radius,mat,points=5):
    vs=[(0,0,.012)]
    for j in range(points*2):
        a=j*pi/points;r=radius if j%2==0 else radius*.43
        vs.append((cos(a)*r,sin(a)*r,0 if j%2==0 else -.014))
    o=mesh(name,vs,[(0,j+1,(j+1)%(points*2)+1) for j in range(points*2)],mat)
    o.location=loc;return o

def cream_dollop(loc,angle,mat,scale=1):
    for j in range(5):
        a=angle+j*2*pi/5
        sphere("piped_cream",(loc[0]+cos(a)*.045*scale,loc[1]+sin(a)*.045*scale,loc[2]),(.085*scale,.055*scale,.13*scale),mat,rings=10,segments=14)
    sphere("piped_cream",(loc[0],loc[1],loc[2]+.075*scale),(.055*scale,.055*scale,.12*scale),mat,rings=9,segments=12)

def build(theme):
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
    chocolate=theme=="chocolate";blueberry=theme=="blueberry"
    names={"chocolate":("ganache","glaze"),"blueberry":("buttercream","cream_petals"),"redvelvet":("red_velvet_crumb","cream_cheese")}
    base_colors={"chocolate":((.028,.009,.004),.54,.10),"blueberry":((.53,.33,.42),.64,0),"redvelvet":((.23,.012,.018),.76,0)}
    top_colors={"chocolate":((.027,.007,.003),.29,.32),"blueberry":((.58,.38,.48),.57,0),"redvelvet":((.83,.74,.63),.64,0)}
    bc,br,bcoat=base_colors[theme];tc,tr,tcoat=top_colors[theme]
    base=material(names[theme][0],bc,br,coat=bcoat)
    top=material(names[theme][1],tc,tr,coat=tcoat)
    board=material("charcoal_ceramic",(.027,.026,.025),.32,coat=.2)
    crumb_names={"chocolate":"cocoa_crumb","blueberry":"rose_fleck","redvelvet":"velvet_crumb"}
    crumb_colors={"chocolate":(.09,.031,.012),"blueberry":(.18,.018,.053),"redvelvet":(.32,.012,.018)}
    crumb=material(crumb_names[theme],crumb_colors[theme],.85)
    lathe("serving_plate",[(0,0),(1.62,0),(1.69,.03),(1.71,.055),(1.69,.08),(1.53,.095),(0,.095)],board)
    profile=[(0,.105),(1.31,.105),(1.382,.132)]
    for j in range(65):
        hand_variation=.009*sin(j*.17)+.004*sin(j*.61)+(.003 if j%11<3 else -.002)
        profile.append((1.402+hand_variation,.16+j*.016))
    profile.extend([(1.392,1.2),(1.355,1.23),(0,1.23)])
    lathe("cake_body",profile,base,noise=.013 if chocolate else .008,cream=blueberry)
    if chocolate:
        attach_pbr(base,pbr_texture_set("dark_ganache",(.040,.011,.005),(.20,.058,.022),.58,3.1),.24)
        # The broad top stays uniform; its wetness is expressed by live reflection.
        # Large baked color variation reads as a false spotlight on this flat surface.
        lathe("mirror_glaze",[(0,1.235),(1.32,1.235),(1.39,1.225),(1.419,1.20),(1.425,1.13),(1.422,1.07)],top,noise=.003)
        nutmat=vertex_material("roasted_hazelnut",.72)
        cherry=vertex_material("amarena_cherry",.34,coat=.34)
        curls=material("chocolate_ribbon",(.12,.045,.021),.37)
        stemmat=material("cherry_stem",(.025,.018,.008),.76)
        gold=material("edible_gold",(.82,.52,.16),.24,metal=1)
        # An asymmetric crescent leaves quiet negative space around the candles.
        for k in range(30):
            a=-2.38+k/29*3.82+random.uniform(-.07,.07);r=.91+random.uniform(-.10,.12)
            o=sphere("hazelnut",(r*cos(a),r*sin(a),1.32),(.095,.09,.105),nutmat,nut=True,phase=k*.71)
            o.rotation_euler=(random.random()*pi,random.random()*pi,a)
        for k in range(9):
            a=-2.15+k/8*3.25+random.uniform(-.12,.12);r=.74+random.random()*.32
            x,y,z=r*cos(a),r*sin(a),1.39+random.uniform(-.01,.07)
            s=random.uniform(.90,1.08)
            o=sphere("glossy_cherry",(x,y,z),(.14*s,.135*s,.13*random.uniform(.90,1.08)),cherry,cherry=True,phase=k*1.37)
            o.rotation_euler=(random.uniform(-.16,.16),random.uniform(-.16,.16),random.random()*pi)
            if k%3==0:
                bend=.045*(-1 if k%2 else 1)
                curve("cherry_stem",[(x,y,z+.112),(x+bend,y+.01,z+.21),(x+bend*.4,y+.025,z+.29)],.009,stemmat)
        for k in range(7):
            a=-2.2+k/6*3.45;r=.73+random.random()*.29
            ribbon((r*cos(a),r*sin(a),1.22),a,curls,k)
        for k in range(8):
            a=-2.55+k/7*4.15+random.uniform(-.16,.16);r=1.405
            length=random.uniform(.10,.30)
            width=random.uniform(.032,.060)
            sphere("ganache_drip",(r*cos(a),r*sin(a),1.12-length*.5),(width,width*random.uniform(.76,1.05),length),top,rings=12,segments=16)
            # A thicker shoulder explains where each gravity-driven drip begins.
            sphere("ganache_drip",(r*cos(a),r*sin(a),1.145),(width*1.35,width*1.15,.045),top,rings=9,segments=14)
        for k in range(110):
            a=random.random()*2*pi;r=sqrt(random.random())*1.3
            x,y=r*cos(a),r*sin(a);s=random.uniform(.012,.045)
            mesh("gold_leaf",[(x,y,1.244),(x+s,y+.01,1.25),(x+s*.8,y+s,1.26),(x-.01,y+s*.7,1.247)],[(0,1,2,3)],gold)
    elif blueberry:
        berry=vertex_material("blueberry_bloom",.53,coat=.10)
        calyx=material("blueberry_calyx",(.025,.033,.057),.75)
        # Original constellation layout: sparse fruit and offset cream peaks,
        # deliberately unlike the concentric blueberry reference photograph.
        for ring,n in ((.92,9),(.58,6),(.22,2)):
            for k in range(n):
                a=k/n*2*pi+ring;r=ring+random.uniform(-.045,.045)
                s=random.uniform(.135,.175);z=1.24+s*.80
                o=sphere("blueberry",(r*cos(a),r*sin(a),z),(s,s,s*.86),berry,berry=True)
                # Small five-point crown on berry's dimple.
                vs=[(0,0,0)]+[(cos(j*pi/5)*(.045 if j%2==0 else .021),sin(j*pi/5)*(.045 if j%2==0 else .021),.008 if j%2==0 else -.008) for j in range(10)]
                c=mesh("berry_crown",vs,[(0,j+1,(j+1)%10+1) for j in range(10)],calyx)
                c.location=(r*cos(a),r*sin(a),z+s*.72)
        for k in range(13):
            a=-2.5+k/12*3.7;r=.78+random.uniform(-.13,.16)
            petal((r*cos(a),r*sin(a),1.22),a+.52,random.uniform(.72,.94),top)
    else:
        dollop_mat=material("piped_cream_cheese",(.83,.74,.63),.64)
        lathe("cream_cheese_top",[(0,1.232),(1.30,1.232),(1.39,1.245),(1.40,1.31),(1.34,1.35),(0,1.35)],top,noise=.004,cream=True)
        for z in (.43,.78,1.08):
            lathe("cream_cheese_layer",[(0,z-.028),(1.392,z-.028),(1.425,z),(1.392,z+.035),(0,z+.035)],top,segments=160,noise=.003,cream=True)
        raspberry=material("raspberry",(.39,.006,.018),.55,coat=.05)
        leaf=material("raspberry_leaf",(.075,.16,.05),.76)
        for k in range(9):
            a=.20+k/9*2*pi
            r=.99;cream_dollop((r*cos(a),r*sin(a),1.38),a,dollop_mat,.9)
            cx,cy=r*.74*cos(a),r*.74*sin(a)
            for j in range(8):
                aa=j*2.399;rr=.045*sqrt(j)
                sphere("raspberry_drupe",(cx+cos(aa)*rr,cy+sin(aa)*rr,1.50+.025*sin(j)),(.055,.055,.052),raspberry,rings=8,segments=10)
            crown("raspberry_calyx",(cx,cy,1.58),.045,leaf)
        for k in range(85):
            a=random.random()*2*pi;r=sqrt(random.random())*.70;s=random.uniform(.009,.024)
            sphere("velvet_top_crumb",(r*cos(a),r*sin(a),1.36+random.uniform(0,.018)),(s,s*.8,s*.65),crumb,rings=5,segments=7)
    # Surface freckles and crumbs deliberately non-uniform.
    for k in range(170 if chocolate else 80 if blueberry else 55):
        a=random.random()*2*pi;z=random.uniform(.13,.30) if chocolate else random.uniform(.25,1.14)
        r=1.425;s=random.uniform(.012,.038)
        o=sphere("crumb" if chocolate else "dried_rose",(r*cos(a),r*sin(a),z),(s,s*.45,s*.7),crumb,rings=5,segments=7)
        o.rotation_euler[2]=a
    # Consolidate by material to keep browser draw calls bounded.
    bpy.ops.object.select_all(action="SELECT");bpy.ops.object.convert(target="MESH")
    # Ensure closed food surfaces face outward; area-weighted consistency on open curls.
    for obj in list(bpy.context.selected_objects):
        if obj.type!="MESH":continue
        bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT");bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode="OBJECT")
    mats={}
    for ob in list(bpy.context.scene.objects):
        if ob.type=="MESH":mats.setdefault(ob.data.materials[0].name,[]).append(ob)
    for name,objects in mats.items():
        bpy.ops.object.select_all(action="DESELECT")
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        objects[0].name=name
        # One packed UV set lets glTF carry the baked PBR maps into Three.js.
        bpy.context.view_layer.objects.active=objects[0]
        if chocolate and name in ("ganache","glaze"):food_uv(objects[0])
        else:
            bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012)
            bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,"scene",theme+".blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,theme+".glb"),export_format="GLB",export_yup=True,export_apply=True,export_materials="EXPORT")
    print("EXPORTED",theme)

for requested_theme in os.environ.get("CAKE_THEMES","chocolate,blueberry,redvelvet").split(","):
    build(requested_theme.strip())
