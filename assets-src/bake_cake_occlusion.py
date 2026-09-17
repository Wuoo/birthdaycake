"""Bake local contact occlusion into an independent UV set for real-time glTF."""
import bpy,os,math
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.bake.margin=6;scene.render.bake.use_clear=True
name=os.path.splitext(os.path.basename(bpy.data.filepath))[0]
group=bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
if not any(s.name=='Occlusion' for s in group.interface.items_tree):group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
objects=[o for o in scene.objects if o.type=='MESH']
for obj in objects:
    if 'ceramic' in obj.name or 'stem' in obj.name or 'gold' in obj.name:continue
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    uv=obj.data.uv_layers.get('ContactUV') or obj.data.uv_layers.new(name='ContactUV')
    obj.data.uv_layers.active=uv;uv.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.015)
    bpy.ops.object.mode_set(mode='OBJECT')
    size=1024 if 'cream' in obj.name or 'ganache' in obj.name else 512
    image=bpy.data.images.new(name+'_'+obj.name+'_contact',width=size,height=size,alpha=False)
    image.colorspace_settings.name='Non-Color'
    restore=[]
    for mat in obj.data.materials:
        nt=mat.node_tree;out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
        previous=out.inputs['Surface'].links[0].from_socket
        ao=nt.nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.20;ao.samples=16
        emission=nt.nodes.new('ShaderNodeEmission');nt.links.new(ao.outputs['Color'],emission.inputs['Color']);nt.links.new(emission.outputs[0],out.inputs['Surface'])
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image;nt.nodes.active=tex;tex.select=True
        restore.append((nt,out,previous,ao,emission,tex))
    bpy.ops.object.bake(type='EMIT')
    image.pack()
    for nt,out,previous,ao,emission,tex in restore:
        nt.links.new(previous,out.inputs['Surface']);nt.nodes.remove(ao);nt.nodes.remove(emission)
        uvnode=nt.nodes.new('ShaderNodeUVMap');uvnode.uv_map='ContactUV';nt.links.new(uvnode.outputs[0],tex.inputs['Vector'])
        export=nt.nodes.new('ShaderNodeGroup');export.node_tree=group;nt.links.new(tex.outputs['Color'],export.inputs['Occlusion'])
    obj.data.uv_layers.active=obj.data.uv_layers['UVMap'];obj.data.uv_layers['UVMap'].active_render=True
    print('BAKED_CONTACT',obj.name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
outpath=os.path.join(ROOT,'outputs','cake-v2','models',name+'.glb')
bpy.ops.export_scene.gltf(filepath=outpath,export_format='GLB',export_yup=True,export_apply=True,export_materials='EXPORT')
print('BAKED_EXPORT',outpath)
