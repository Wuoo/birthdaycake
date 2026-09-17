"""Cinematic validation of actual authored meshes, not an AI-generated image."""
import bpy, math, os, random
from mathutils import Vector
from math import sin, cos, pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1066;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(ROOT,'outputs','cake-v2',name+'-hero.png')
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.06,.08,.13,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.23
def mat(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.clear()
    p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.name='Principled BSDF';out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs[0],out.inputs[0])
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
def aim(obj,point=(0,0,.9)):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(pos,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o);return o
light((-3,-4,5),480,3.3,(1,.68,.42));light((4,-1,3.5),110,3,(.52,.65,1));light((0,4,4.5),350,2.4,(1,.74,.5))
bpy.ops.object.camera_add(location=(3.5,-5.3,3.65));cam=bpy.context.object;cam.data.lens=49;aim(cam);scene.camera=cam
cam.data.dof.use_dof=True;cam.data.dof.focus_distance=(cam.location-Vector((0,0,.9))).length;cam.data.dof.aperture_fstop=7.1
# Original wood texture nodes, all variation is in material space.
wood=mat('walnut',( .05,.019,.007),.43)
nt=wood.node_tree;p=nt.nodes.get('Principled BSDF');tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=3
coord=nt.nodes.new('ShaderNodeTexCoord');mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1.5,35,4)
nt.links.new(coord.outputs['Generated'],mapping.inputs[0]);nt.links.new(mapping.outputs[0],tex.inputs[0]);ramp=nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position=.2;ramp.color_ramp.elements[0].color=(.018,.005,.002,1)
ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(.15,.056,.016,1)
nt.links.new(tex.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.17;bump.inputs['Distance'].default_value=.013
nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.1));table=bpy.context.object;table.scale=(16,12,.18);table.data.materials.append(wood)
# Out of focus midnight architecture and warm points.
wall=mat('night',( .009,.014,.025),.9)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,5,3));o=bpy.context.object;o.scale=(18,.12,9);o.data.materials.append(wall)
glow=mat('distant_windows',(.8,.40,.12));p=glow.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.52,.15,1);p.inputs['Emission Strength'].default_value=2
random.seed(324)
for k in range(45):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=random.uniform(.015,.05),location=(random.uniform(-7,7),4.8,random.uniform(.3,5.5)))
    bpy.context.object.data.materials.append(glow)
# Three separate physical candles; animation remains authored in Three.js.
wax=mat('ivory_wax' if name=='blueberry' else 'burgundy_wax',(.76,.61,.40) if name=='blueberry' else (.28,.018,.037),.48)
wick=mat('wick',(.006,.003,.001),.9)
flame=mat('flame',(.9,.37,.035));p=flame.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.47,.085,1);p.inputs['Emission Strength'].default_value=13
for k in range(3):
    a=k*2*pi/3+.3;x,y=.43*cos(a),.43*sin(a);h=.55+[.06,.14,0][k]
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.032,depth=h,location=(x,y,1.23+h/2));bpy.context.object.data.materials.append(wax)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.006,depth=.037,location=(x,y,1.23+h+.015));bpy.context.object.data.materials.append(wick)
    vs=[];fs=[];n=32;nr=24
    for j in range(nr+1):
        t=j/nr;r=.038*sin(pi*t)**.7*(1-.5*t)
        for i in range(n):
            a=i*2*pi/n;vs.append((x+r*cos(a)+.025*t*t,y+r*sin(a),1.23+h+.018+t*.22))
    for j in range(nr):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    me=bpy.data.meshes.new('flame');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('flame',me);scene.collection.objects.link(ob);ob.data.materials.append(flame)
    for poly in me.polygons:poly.use_smooth=True
    bpy.ops.object.light_add(type='POINT',location=(x,y,1.23+h+.12));bpy.context.object.data.energy=2;bpy.context.object.data.color=(1,.48,.12);bpy.context.object.data.shadow_soft_size=.08
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
bpy.ops.render.render(write_still=True)
print('HERO',scene.render.filepath)
