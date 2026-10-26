# Claude娘桌宠

> 粉丝自制，非官方，与 Anthropic 无关。**免费、开源，所有人都可以下载使用。**
> A free, fan-made desktop pet for Claude Code. Unofficial and not affiliated with Anthropic.

<p align="center"><img src="docs/preview.png" width="300" alt="Claude娘桌宠"></p>

演示视频：[B站](https://www.bilibili.com/video/BV17enb6NE1y/) · [YouTube](https://youtu.be/k30HEh84SPA)
· 实机演示（竖屏）：[B站](https://www.bilibili.com/video/BV1E6nY62EUL/) · [YouTube Shorts](https://youtube.com/shorts/k4rpz727DPk)

一个坐在书桌后看书的 Claude娘桌宠，和 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 联动：
Claude Code 读文件、写代码、跑命令、联网搜索的时候，她会换上对应的表情和动作，头上的气泡写着正在做什么。

角色原型来自 B 站 UP 主 **ZipZipPipe** 的 Claude娘设定，原作者已允许二次创作。
衣服、道具和贴图里不使用 Claude / Anthropic 的商标、星芒图案或 Clawd 吉祥物。

> **这是第一版（v0.1）。** 现在的角色是自动绑定的 2.5D 模型：会呼吸、眨眼、说话时动嘴、头发摆动、翻书点头。
> **之后做好 Live2D 模型会更新桌宠**，动作和表情会丰富很多。请关注本仓库的 Release。

## 下载与使用（Windows 10 / 11）

1. 到 [Releases](../../releases/latest) 下载 `ClaudeChan-DesktopPet-*-win64.zip`，解压到任意文件夹（路径里有中文也可以）。
   压缩包里已经带了 Electron 运行时，不用另外安装。
2. 双击 **`启动桌宠.bat`**，桌宠会出现在屏幕右上角。
   - 拖动可以移动她；右键菜单可以切换置顶、固定位置（锁住后不能拖动）、调整大小（6 档；位置和这些设置下次启动沿用）、重新载入、关闭。
3. 和 Claude Code 联动：先装 [Node.js](https://nodejs.org/)（Claude Code 的 hook 用它运行），再双击 **`安装联动.bat`**。
   之后**新开**的 Claude Code 会话就会驱动桌宠。
   - 脚本会先备份 `%USERPROFILE%\.claude\settings.json`，其他设置原样保留；重复运行不会装两份。
   - 卸载：在命令行运行 `安装联动.bat uninstall`。

不装联动也能单独当桌宠摆着看。

## 她会做什么

| Claude Code 在做 | 桌宠状态 | 气泡 |
|---|---|---|
| 收到你的消息 | 思考 | 收到，正在想… |
| Read / Glob / Grep | 看书、扫读、翻页 | 正在读 pet.html |
| Write / Edit | 埋头写 | 正在写 main.js |
| Bash / PowerShell | 跑命令 | 正在跑命令：npm test |
| WebSearch / WebFetch | 查资料 | 正在查：… |
| Task / Agent | 派帮手 | 派了个帮手：… |
| 连续 3 次顺利 | 得意 | 很顺利 |
| 同一工具连错 2 次 | 皱眉 | 这一步不太顺… |
| 等你回答 / 授权 | 抬头看你 | 有事想问你 |
| 一轮结束 | 微笑 | 这一轮完成了 |
| 一轮超过 90 秒且安静 20 秒 | 打瞌睡 | 这一步有点久…… |

工具名和状态的对照表在 `hooks/tool-map.json`，Claude Code 改了工具名时只需要改这个文件。
状态文件位置：`%USERPROFILE%\.claude\pet\state.json`（可以用环境变量 `CLAUDE_PET_STATE` 改）。

## 常见问题

**双击后什么都没出现。** 运行 `start-pet.bat debug` 看日志。如果 Electron 一启动就退出（退出码 0x80000003，
日志里有 `crashpad ... not connected`），多半是这个文件夹位于某个 AI 编程工具的沙箱工作区里
（例如 Windows 上的 OpenAI Codex 会给工作区加“低完整性”标记，里面启动的 exe 建不了 Chromium 沙箱）。
把桌宠解压到别的文件夹，或者运行
`powershell -ExecutionPolicy Bypass -File .\tools\install-runtime.ps1 -From .\electron`
把运行时复制到 `%LOCALAPPDATA%\ClaudePet\electron`。

**hook 会不会拖慢 Claude Code？** 每个 hook 只读写一个小 JSON 文件，几十毫秒内结束；永远以 0 退出、不输出任何内容，
不会挡住工具调用，也不会往对话里塞内容。

**会联网或上传什么吗？** 不会。桌宠只在本机 127.0.0.1 起一个只读的小服务器给自己的页面用。

## 目录

```
启动桌宠.bat / start-pet.bat   启动
安装联动.bat                   把 hook 装进 Claude Code
electron-app/   Electron 宿主：透明置顶窗口，读状态文件推给页面
web/            桌宠页面（pet.html）、模型配置、2.5D 绑定（web/rig/）、立绘模式素材
hooks/          Claude Code hook（pet-hook.js）、工具对照表、安装脚本
tools/          运行时安装脚本；本地生图/ 是立绘重绘、表情差分、放大、拆层的脚本
art/            定稿立绘
```

## 开发进度

- [x] 桌宠程序：Electron 宿主、Claude Code hook、安装脚本
- [x] 立绘定稿、9 个表情差分
- [x] 2.5D 模式：See-through 自动拆层 + Anime2.5DRig 自动绑定，看书类动作
- [ ] **Live2D 模型**（做好后发布新版本）
- [ ] 持羽毛笔写字、托腮等需要新画手部的动作
- [ ] 服装细节精修

## 致谢

- 角色原型：B 站 UP 主 ZipZipPipe
- 立绘：以 Animagine XL 4.0 生成并本地重绘、修整
- 自动拆层：[See-through](https://github.com/shitagaki-lab/see-through)（Apache-2.0）
- 2.5D 自动绑定与渲染：[Anime2.5DRig](https://github.com/852wa/Anime2.5DRig)（MIT，随附于 `web/rig/`，许可证见其目录）
- Live2D 渲染：[pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)（MIT）、[PixiJS](https://pixijs.com/)（MIT）、Live2D Cubism Core
  （适用 [Live2D Proprietary Software License](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)）
- 运行时：[Electron](https://www.electronjs.org/)（MIT，Release 压缩包的 `electron/` 里附有其许可证）

## 许可证

本项目自己的代码和美术采用 [CC BY-NC-SA 4.0](LICENSE)（署名 - 非商业性使用 - 相同方式共享）：
可以免费使用、修改、转载，但**不得商用**，转载或改编请注明出处并以相同协议发布。
随附的第三方组件（`web/rig/`、`web/vendor/`、`electron/`）各自沿用其原许可证。

“Claude”是 Anthropic 的商标；本项目是粉丝作品，与 Anthropic 没有任何关联。
