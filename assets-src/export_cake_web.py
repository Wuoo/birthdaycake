"""Compress web geometry; keep the editable Blender source unchanged."""
import bpy,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    if len(obj.data.polygons)>25000:
        mod=obj.modifiers.new('web geometry budget','DECIMATE');mod.ratio=.65
out=os.path.join(ROOT,'public','models','patisserie-v3',name+'.glb')
os.makedirs(os.path.dirname(out),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_yup=True,export_apply=True,export_materials='EXPORT',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
print('WEB_EXPORT',out,os.path.getsize(out))
