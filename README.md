# dsh-reach-point

<p align="center">
  <img src="./docs/rail-preview.svg" alt="dsh-reach-point 安装后效果" width="720">
</p>

为 DeepSeek Harness（DSH）Web 对话提供轻量的输入定位导航。界面采用 Codex 风格：聊天内容左侧用细短线标记每次真实用户输入，当前阅读位置显示为更长的深色线；悬停或键盘聚焦时，在刻度右侧显示圆角摘要卡。

Host 从当前会话日志读取全量输入，Web 端再用页面锚点判断哪些消息已加载。点击未加载刻度时，插件会按需触发“加载更早”并定位，不会在打开会话时预先展开全部历史。

## 功能

- 点击刻度平滑跳转，并短暂高亮目标输入
- 在轨道上滚动鼠标滚轮逐条浏览输入
- 支持方向键、Home、End、Enter 和 Space
- 长会话保留全部刻度；轨道自身可滚动，当前刻度自动保持可见
- 自动跟随 DSH 明暗主题，也兼容常见 Web 主题标记与系统配色
- 窄屏或左侧空间不足时自动隐藏，避免遮挡正文
- 尊重系统 `prefers-reduced-motion` 设置

## 安装

当前目录可直接链接安装：

```powershell
dsh plugin --profile web add link:/path/to/dsh-reach-point
```

其他位置请换成插件的绝对路径：

```powershell
dsh plugin --profile web add link:/absolute/path/to/dsh-reach-point
```

安装后重启 `dsh web`，再刷新浏览器页面。

`dsh-node-nav` 与本插件功能重叠，请二选一安装，避免同时注入导航 UI。

## 卸载

```powershell
dsh plugin --profile web remove dsh-reach-point
```

随后重启 `dsh web` 并刷新页面。

## Host API

Host 仅注册 `GET /plugins/dsh-reach-point/api/users?sessionId=<id>`。它读取已附着会话的真实用户输入（`user/message`、`role: user`、`source.kind: user`），返回 `{ users: [{ id, seq, time, text }] }`。图片内容显示为 `[图片]`，文本块以换行合并；未知或尚未附着的会话返回空列表，此时 Web 端回退到当前页面的 DOM 锚点。

本包为 ESM、零运行时依赖、无需构建。可运行：

```powershell
npm test
npm run check
```
