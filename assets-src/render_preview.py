"""Render a neutral validation still of the currently opened cake .blend file."""
import bpy, os
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
blend_name=os.path.splitext(os.path.basename(bpy.data.filepath))[0] or "cake"
OUT=os.path.join(ROOT,"outputs",blend_name+"-material-check.png")
os.makedirs(os.path.dirname(OUT),exist_ok=True)

scene=bpy.context.scene
scene.render.engine="BLENDER_EEVEE"
scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG";scene.render.filepath=OUT
scene.render.film_transparent=False
scene.world.color=(.004,.003,.003)

def look_at(obj,point):
    obj.rotation_euler=((Vector(point)-obj.location).to_track_quat("-Z","Y")).to_euler()

bpy.ops.object.camera_add(location=(4.4,-5.2,3.55))
camera=bpy.context.object;look_at(camera,(0,0,.78));camera.data.lens=58;scene.camera=camera

for loc,energy,size,color in [((-3.5,-3.0,5.0),1050,4.0,(1.0,.55,.31)),((4.0,-1.0,3.5),650,3.0,(.40,.52,1.0)),((0,4.0,4.5),850,2.2,(1.0,.25,.12))]:
    bpy.ops.object.light_add(type="AREA",location=loc)
    light=bpy.context.object;light.data.energy=energy;light.data.shape="DISK";light.data.size=size;light.data.color=color;look_at(light,(0,0,.8))

bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.012))
floor=bpy.context.object
mat=bpy.data.materials.new("preview_walnut");mat.diffuse_color=(.045,.018,.008,1);mat.use_nodes=True
mat.node_tree.nodes.clear();bsdf=mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled");output=mat.node_tree.nodes.new("ShaderNodeOutputMaterial");mat.node_tree.links.new(bsdf.outputs["BSDF"],output.inputs["Surface"])
bsdf.inputs["Base Color"].default_value=(.045,.018,.008,1);bsdf.inputs["Roughness"].default_value=.55
floor.data.materials.append(mat)

scene.view_settings.look="AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)
print("RENDERED",OUT)
