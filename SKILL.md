---
name: xhs-minitool-preview
description: 在电脑浏览器里预览小红书小工具：手机外框（iPhone 18 Pro 等机型）+ 模拟小红书返回/分享按钮 + 模拟 window.xhs（getWindowInfo、Storage、保存相册、发笔记），改文件自动刷新，多个小工具一键切换。改 UI、调布局、看分享海报、走完整流程时先用它，不必每次上传扫码。用户说“本地预览/本地看看/开个预览/模拟器”，或改完小工具界面需要查看时使用。
---

# 小红书小工具本地预览

改 UI 时用本地预览快速迭代，确认差不多了再上传、扫码真机预览。送审前的扫码预览**不能**用本地预览代替。

需要 Node.js 20+，无第三方依赖，不需要 npm install。

## 启动

参数可以是单个小工具目录（含 `index.html`），也可以是装着多个小工具的父目录（自动找 `*/src/index.html`、`*/dist/index.html`、`*/index.html`），预览页顶部下拉切换：

```bash
node "<SKILL_DIR>/scripts/preview.js" "<小工具目录或父目录>" --open
```

- 用后台方式启动（进程要一直跑着），读输出里的 `PREVIEW_URL:` 交给用户；`--open` 会用默认浏览器直接打开。启动前先确认是否已有预览进程在跑，有就复用，别重复起。
- 打开指定小工具：URL 后加 `#<目录名>`，例如 `http://127.0.0.1:5178/#my-tool`。
- 默认端口 5178，被占用自动 +1；`--port N` 指定端口。
- 只监听 127.0.0.1，局域网其他设备访问不到。
- 当前在看的小工具有改动（含 css/js/图片）自动刷新；存储按小工具分开保留，要从头体验点“清存储”。
- 用户说不用了或任务结束时停掉进程。

## 预览页里有什么

- **顶栏**：小工具切换、刷新、清存储、机型、状态栏黑/白字；最右的圆点绿色表示已连上预览服务（改文件会自动刷新），红色表示服务断了。
- **手机外框**：默认 iPhone 18 Pro（小灵动岛、超窄边框），另有 18 Pro Max、16/15、14/13 刘海、SE、Android 两档。
- **小红书按钮**：左上返回、右上分享，画在小工具上层，点击只弹提示。`getWindowInfo().menuButtons` 返回的就是这两个按钮在画面里的矩形（`back`、`share`），顶部避让逻辑可以直接看效果。
- **模拟 window.xhs**：`launchOptions.miniToolEnv.buildVersion`、`getLaunchOptions`、`getWindowInfo`、`getStorage/setStorage/removeStorage`、`writeTempFile`、`saveImageToPhotosAlbum`（弹出保存的图片）、`postNote`（弹出模拟发布页，展示标题/正文/图片，标题超 20 字报错）。
- **右侧调用日志**：每次容器调用和返回值；JS 报错、未处理的 Promise 拒绝，以及调用容器禁用能力（`window.open`、`prompt`、剪贴板、跨域 fetch、外链/下载链接）会标红。

模拟环境只在预览服务返回 HTML 时注入，源码和打包出的 zip 不受影响。

## 局限（向用户说明，不要夸大）

- 跑在桌面浏览器里，不是小红书客户端的 WebView：老内核下的 JS 语法和 CSS 兼容问题这里看不出来，仍要做兼容性检查并真机扫码。
- 按钮位置、安全区、灵动岛尺寸是按真机观感估的，不是官方数值；量到准确位置后改 `assets/shell.html` 里的 `DEVICES` / `BTN*` 常量。
- iframe 里 `env(safe-area-inset-*)` 恒为 0，改为注入 `--safe-area-inset-*` 变量（和官方模拟器一样），顶部等于状态栏高度，返回/分享按钮在它下面 44px 高的一行里垂直居中，和真机一致。
- 不模拟 CSP、长按菜单禁用、真实分享面板。
- 平台官方模拟器是 `redapp dev`，需要更接近官方容器行为时可用。
