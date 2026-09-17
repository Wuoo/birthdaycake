# A Wish for You · 生日烛光

一个可以许愿的互动生日网站。它为漂泊在外的人准备一张安静的生日桌：选择蛋糕，点亮蜡烛，听一首歌，再从礼盒中抽取一张可以保存的心愿卡。

## 在线体验

<https://wuoo.github.io/birthdaycake/>

## 主要体验

- 午夜巧克力、蓝莓星轨、经典红丝绒三套生日桌主题。
- 1–12 支实时蜡烛、火焰、烛光、余烟和室内顶灯。
- 蛋糕切换时同步更换花材、桌面、礼盒和音乐。
- 连续开盒抽卡动画、边缘金粉、背景虚化。
- 支持指针、触控与主动授权的陀螺仪烫金反光。
- 将抽到的心愿卡下载为 PNG。

## 技术

React 19、TypeScript、Three.js 与自定义 GLSL Shader。蛋糕模型、材质和贴图由 Blender 制作并导出为 Draco 压缩 GLB。画面使用 AgX 色彩映射、缓存阴影、自适应分辨率、离屏暂停和按空闲状态加载资源。

## 本地运行

需要 Node.js 22.13 或更新版本。

```sh
npm install
npm run dev -- --port 5186
```

检查和构建：

```sh
npx tsc --noEmit
npm run build
npm run build:pages
```

`main` 分支更新后，GitHub Actions 会自动构建并发布 GitHub Pages。
