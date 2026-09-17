"""Check cherry support on the final joined Blender mesh, without editing it."""
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name=='ganache')
support=BVHTree.FromPolygons([body.matrix_world @ v.co for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons])
cherries=next(o for o in bpy.context.scene.objects if o.type=='MESH' and 'amarena_cherry' in o.name)
bm=bmesh.new();bm.from_mesh(cherries.data)
pending=set(bm.verts);gaps=[]
while pending:
    seed=pending.pop();component={seed};stack=[seed]
    while stack:
        vertex=stack.pop()
        for e in vertex.link_edges:
            other=e.other_vert(vertex)
            if other in pending:
                pending.remove(other);component.add(other);stack.append(other)
    if len(component)<30:continue
    distances=[]
    for v in component:
        p=cherries.matrix_world @ v.co
        hit=support.ray_cast(Vector((p.x,p.y,3)),Vector((0,0,-1)))
        if hit[0] is not None:distances.append(p.z-hit[0].z)
    gaps.append(min(distances))
bm.free()
assert len(gaps)==7, f'Expected 7 cherries, found {len(gaps)}'
assert all(-.008<gap<.0005 for gap in gaps), gaps
print('CONTACT_CHECK_PASS', [round(gap,6) for gap in sorted(gaps)])
