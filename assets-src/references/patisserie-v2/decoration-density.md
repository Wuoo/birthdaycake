# Decoration density pass

Original procedural geometry; reference images guide composition only.

- Blueberry: 31 berries in three staggered crescent bands, 9 piped rosettes, 6 ivory shards, 100 compote fragments. Center remains reserved for candles.
- Chocolate: 34 whole/cut nut placements, 7 cherries (5 stems), 12 curls/shards, 48 gold fragments, 680 top crumbs. Decorations are concentrated outside radius 0.66.
- Rebuild with `CAKE_THEMES=blueberry,chocolate` and `build_cakes_v2.py`, then run `bake_cake_occlusion.py` and `export_cake_web.py` on each saved scene.
- Bake contact occlusion after geometry changes. Keep editable sources in `scene/v2`; browser assets are in `public/models/patisserie-v3`.

This pass increases composition density. It does not establish photographic material fidelity; food surface variation and scene furnishings still need refinement.

## Contact and lighting revision

- Decorations now settle against a BVH of the actual frosting surface, after rotation. Whole fruit, nuts, cut nut assemblies and chocolate curls/shards use a 0.003-unit soft embed (0.3 mm at the authored decimeter scale). Stems follow corrected cherry heights.
- `validate_cake_contact.py` independently traverses the joined cherry mesh and checks all seven fruit components against the cake. Observed contact gaps: all -0.003 units.
- Blueberry frosting has seeded broad knife passes modeled as geometric bellies and raised lips, in addition to the existing micro-normal maps.
- Web key and shadow lights share position and target. Ambient fill is reduced, the key shadow is 2048 square with smaller normal bias, and asynchronous model loads invalidate the cached shadows.
- Production build and TypeScript passed. Browser chocolate preview with three lit candles measured 36 FPS at quality 1 in the current narrow panel; this is not a full-screen performance guarantee.
- This is a static seating approximation, not a rigid-body collision simulation between every decoration. The reference's photographic fidelity remains a separate visual target.
