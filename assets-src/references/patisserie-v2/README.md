# 三款蛋糕：效果图与 Blender V2

本目录 PNG 为 AI 生成的原创造型参考，不是实时网页或 Blender 渲染截图。共同目标是食物摄影的材质细度；不得通过把整张照片投射到蛋糕表面来伪造单视角质感。

## 设计

| 款式 | 参考 | 独立造型 | 重点材质 |
|---|---|---|---|
| 蓝莓马斯卡彭 | blueberry-mascarpone.png | 象牙奶油淡紫抹纹，两道错落蓝莓月牙，留白中心、少量白巧卷片及奶油 | 果皮与果粉不同粗糙度、凹陷五瓣果冠、奶油气孔与抹刀痕 |
| 午夜巧克力 | midnight-chocolate.png | 更宽薄的巧克力卷片，整颗及切半榛子，少量暗红樱桃、金箔和碎屑 | 甘纳许、干燥卷片、果实、坚果切面具有独立反光尺度 |
| 经典红丝绒 | red-velvet.png | 象牙奶油包覆、十个裱花、底部不均匀红色碎屑带、后方白巧薄片 | 绵软奶酪霜、细碎多孔蛋糕屑、白巧克力薄边 |

不恢复草莓、切蛋糕和切割动效。蓝莓不沿用用户最初参考的满铺果实、紫色花瓣边和玫瑰花瓣组合。

## 本轮建模产物

- 生成脚本：`assets-src/build_cakes_v2.py`。
- 源文件：`scene/v2/{blueberry,chocolate,redvelvet}.blend`。
- 试验 GLB：`outputs/cake-v2/models/`。
- 中性灯光实物检查图：`outputs/cake-v2/*-blender.png`，用 `assets-src/render_cakes_v2.py` 生成。
- 网页已接入 `public/models/patisserie-v3/`，原 `public/models/*.glb` 保留作回退。当前仍为迭代版本，尚未达到效果图的摄影级真实感。

## 材质和几何边界

使用原创程序化纹理生成 Base Color、Roughness、Normal 图片；另外通过 Cycles 烘焙局部接触遮蔽到第二套 ContactUV，由 glTF 的 occlusionTexture 使用。不是摄影扫描，也不是完整的高模法线烘焙。果实使用独立球面 UV，基础霜面使用按物理尺度调整的柱面/平面 UV；接触遮蔽与基础颜色独立，不把烛光方向烘进颜色。

大形体和装饰厚度靠几何；中尺度抹刀刮痕需要局部几何/高模烘焙；毛孔、果粉、可可粉靠细节贴图。奶油裱花由连续扭转起伏网格构成，不再由一束椭球代替。果冠是凹陷带五瓣边缘的网格。卷片具有真实厚度及接触底面。

## 尚需达到的质量

1. 蓝莓果粉需要更细、可辨识的擦拭分布；目前程序噪声只是基础。奶油抹刀痕仍需更自然的局部刮抹方向和边缘堆积。
2. 巧克力卷片需要更多非重复轮廓与细可可颗粒；榛子切面需补足内部裂隙与浅色纹理，甘纳许应保持柔软湿润而非黑色硬塑料。
3. 红丝绒碎屑应进一步做局部簇团和多孔结构，避免均匀颗粒感。
4. 统一相机、白平衡和侧光检查三款，不用强烛光遮掩材质缺陷。Blender 好看不等于 glTF/Three.js 已一致，网页必须另外检验。
5. 进入网页前检查 GLB 纹理颜色空间、法线、模型尺度、蜡烛留白、遮挡、360°背面、下载体积与帧耗。

## 重建

在项目根目录运行 Blender：

```powershell
& 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --python assets-src/build_cakes_v2.py
& 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b scene/v2/blueberry.blend --python assets-src/render_cakes_v2.py
```

`CAKE_THEMES` 环境变量可以指定单款。每款使用独立固定随机种子，单款重建与全量重建形态一致。

每次重建后必须依次重新运行，不能直接将无烘焙的中间 GLB 覆盖网页资源：

```powershell
& 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b scene/v2/blueberry.blend --python assets-src/bake_cake_occlusion.py
& 'D:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b scene/v2/blueberry.blend --python assets-src/export_cake_web.py
```

另两款同理。网页版使用 Draco 几何压缩，解码器保存在 `public/decoders/draco/`。高精度 Blender 源文件不减面；网页输出只对大型网格减面。

## 2026-09-12 网页验证

- 构建及 TypeScript 检查通过；三款可切换，点燃完成，侧面拖动及红丝绒 12 支蜡烛留白区已观察。
- 移除全屏景深和 Bloom 多次模糊，改为局部烛光光晕；移除樱桃极低透射引起的额外全场景渲染。
- 修复临时加载卡顿导致永久降至 55% 画质的问题，桌面最低为 85%，加入预热期、持续低帧判断及恢复路径。
- 当前设备巧克力实测约 28 FPS、quality=1、画布宽 1897；是一次本机观测，不代表所有设备。之前约 17 FPS、quality=.85、画布宽 1612。
- 火焰 Shader 增加 tone mapping 与输出颜色空间处理，恢复柔和暖白火芯。
- 完成蓝莓、巧克力、红丝绒各 6/6/4 个材质的第二 UV 遮蔽贴图检查。压缩前约 14.4/18/27.3 MB，首版压缩后约 8.6/9.1/7.8 MB（十进制）。
- 未测试真实麦克风吹气、移动端性能或留言写入；不声称完整产品验收。模型自然性、场景背景及摄影氛围仍需继续精修。
