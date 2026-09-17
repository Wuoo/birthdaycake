"""Consistent neutral material validation, separate from AI concept images."""
import bpy, os
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=1440
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(ROOT,'outputs','cake-v2',name+'-blender.png')
scene.world.color=(.15,.15,.15)
def aim(obj):
    obj.rotation_euler=(Vector((0,0,.85))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(4.4,-5.6,4.2))
cam=bpy.context.object;cam.data.lens=55;aim(cam);scene.camera=cam
for loc,power,size,color in [((-3,-4,6),650,4,(1,.87,.73)),((4,-1,4),300,3,(.73,.83,1)),((0,4,5),450,3,(1,.91,.78))]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color;aim(light)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015))
mat=bpy.data.materials.new('neutral_warm_table');mat.diffuse_color=(.055,.035,.025,1)
bpy.context.object.data.materials.append(mat)
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
bpy.ops.render.render(write_still=True)
print('V2_RENDER',scene.render.filepath)
