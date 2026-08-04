# 北牖 NorthBooker 更新日志

本文件记录北牖（NorthBooker）项目的版本演进与变更内容。
发布单位：北域工作室（Northland Studio）

## v2.5.0 (Electron) — 2026-08-05

### 修复

- **修复**：离线 TTS 朗读始终失败（External buffers are not allowed）— 根因是 Electron 内置 V8 禁止创建 Node-API external buffer，与进程模式（主进程 / worker / ELECTRON_RUN_AS_NODE fork）无关；现改为打包附带 node.exe，用独立 Node 子进程执行 sherpa-onnx 推理，通过 IPC 回传音频
- **修复**：打包环境缺少 TTS 运行时 — CI 自动下载 node.exe 并随安装包分发，worker 脚本与原生模块 asarUnpack 解包

### 新增

- **功能**：离线模型音色切换 — AIShell3 支持 174 种音色，设置面板新增音色下拉选择
- **功能**：朗读句子高亮 — TTS 朗读时高亮当前句子并自动跟随滚动内容

## v2.4.1 (Electron) — 2026-08-04

### 新增

- **功能**：设置新增 TTS 朗读配置 — 语速滑杆 + 模型选择（Edge 内置 / sherpa-onnx 离线模型）
- **功能**：嵌入 sherpa-onnx 离线语音合成引擎 — AIShell3 中文多音色模型按需下载（GitHub + CDN 双源），本地推理
- **功能**：TTS 支持"点哪从哪读" — 从编辑器光标位置开始朗读

### 优化

- **样式**：TTS 配置与朗读开关仅桌面应用版可见，网页端隐藏

## v2.4.0 (Electron) — 2026-08-04

### 新增

- **功能**：TTS 朗读 — 桌面端在线文档支持语音朗读（Web Speech API，中文语音 0.9x 速度）
- **功能**：文档列表多选 — 在线文档列表支持多选和批量删除
- **功能**：文档右键菜单 — 在线文档列表支持右键菜单（打开 / 分享 / 删除）

### 优化

- **样式**：在线文档移除 Markdown 编辑模式，统一为富文本编辑器
- **样式**：在线文档列表新增按文档名排序

### 修复

- **修复**：版本历史显示未知用户 — 前端字段映射 author_name → authorName
- **修复**：版本历史不记录时间 — 服务端 INSERT 增加 created_at 显式写入
- **修复**：保存后更新时间不刷新 — doSave 成功后 setUpdatedAt 刷新

## v2.3.2 (Electron) — 2026-08-04

### 修复

- **修复**：服务器缺少版本历史路由导致 /api/pages/:id/versions 返回 404
- **修复**：在线文档自动保存失效 — scheduleSave 闭包陷阱导致 doSave 捕获过时的 canEdit

## v2.3.1 (Electron) — 2026-08-04

### 修复

- **修复**：分享链接生成失败 — 前后端字段名统一（doc_id / expires_in_hours）
- **修复**：托管文件私有设置无效 — 文档列表新增 private 过滤 + toDoc 返回 visibility
- **修复**：在线文档订阅不工作 — API 参数改为 target_type/target_id
- **修复**：数据库启动崩溃 — subscriptions.js import 语法修复

### 优化

- **样式**：统一三处分享入口为 ShareDialog 组件（Documents 右键 / Viewer / PageEditor）
- **体验**：Markdown 模式下文档内搜索支持

## v2.3.0 (Electron) — 2026-08-04

### 新增

- **功能**：全文搜索 — 基于 SQLite FTS5 的跨在线文档全文索引，搜索结果高亮匹配片段
- **功能**：缩略图预览 — PDF/Office 文档自动生成 SVG 缩略图，列表网格展示
- **功能**：批量操作 — 多选文档批量移动到文件夹或批量删除
- **功能**：Markdown 在线编辑器 — 在线文档新增 Markdown 编辑模式，分栏实时预览
- **功能**：文档版本历史 — 编辑自动创建版本快照，支持预览和回滚
- **功能**：文档订阅通知 — 订阅文档/文件夹更新，桌面端 WebSocket 实时推送系统原生通知
- **功能**：密码分享 — 为私有文档生成带密码和过期时间的分享链接
- **功能**：桌面端自定义主题色 — 设置面板 8 种预设色 + 自定义色值选择

### 优化

- **重构**：后端新增 bus.js EventEmitter 解耦 WebSocket 广播
- **样式**：版本历史面板、Markdown 编辑器、批量操作栏、颜色选择器等 UI 组件

## v2.2.0 (Electron) — 2026-08-04

### 新增

- **功能**：网页端下载页重构 — 动态从 GitHub API 获取最新版本号，不再硬编码
- **功能**：下载页双源下载 — 每个平台提供 GitHub + CDN 两个下载按钮，macOS 提供 Intel/Apple Silicon 两种 CDN 包
- **功能**：iOS PWA 安装指南 — Safari 添加到主屏幕三步引导
- **功能**：网站 PWA 支持 — manifest.json + apple-mobile-web-app 元标签，支持 iOS 主屏幕独立应用模式
- **功能**：预留 Android 版下载位置
- **功能**：桌面端导航栏隐藏「应用下载」入口

## v2.1.9 (Electron) — 2026-08-04

### 新增

- **功能**：云字体预设 — 7 款中文字体可选（思源黑体/宋体、站酷快乐体/文艺体、马山手写体、霞鹜文楷），自动从 Google Fonts/jsDelivr CDN 加载
- **功能**：本地字体文件选择 — 支持 .ttf/.otf/.woff/.woff2 文件，主进程读取并注入 @font-face
- **功能**：设置面板新增「检查更新」按钮 — 提供检查中/已是最新/发现新版本/检查失败四种反馈

### 优化

- **样式**：字体设置改为下拉选择 + 自定义输入 + 本地文件按钮

## v2.1.8 (Electron) — 2026-08-04

### 新增

- **功能**：更新通知改为显式下载进度通知 — 右下角卡片展示「发现新版本 → 下载进度 → 完成」
- **功能**：下载完成后通知中可直接操作：立即重启以安装 / 暂不更新 / 查看更新内容
- **功能**：UpdatePopup 三按钮布局 — 查看更新内容 / 暂不更新 / 立即重启以安装

### 变更

- **变更**：autoDownload 改为 false，不再静默下载；CDN updater 同步改为手动模式

## v2.1.7 (Electron) — 2026-08-04

### 新增

- **功能**：窗口大小/位置记忆（electron-store 持久化）
- **功能**：最小化到系统托盘
- **功能**：开机自启动选项
- **功能**：自定义界面字体（CSS 变量注入）
- **功能**：设置面板（视图模式、托盘、自启动、字体）
- **功能**：更新公告弹窗 — 下载完成后显示 release-notes.json 内容

### 修复

- **修复**：文件夹系统崩坏（代理 query 参数丢失）
- **修复**：更新检测不触发问题

## v0.3.0 - 2026-08-04

### 新增

- **功能**：文件托管系统文件夹功能
  - 后端 folders 表 + CRUD API（创建/删除文件夹，级联清理子文档）
  - 前端面包屑路径栏 + 文件夹卡片 + 文件夹导航
  - 网格/列表视图均支持文件夹与文档混合展示
  - 上传文档时支持选择目标文件夹
- **功能**：导航栏汉堡菜单 — 小屏下导航菜单改为固定浮层展开，支持遮罩关闭
- **功能**：在线文档搜索 — 基于 ProseMirror TextSelection 的文档内搜索，精准选中并滚动到匹配位置
- **功能**：评论推入式面板 — 评论区改为右下角悬浮按钮 + 右侧滑入面板，Viewer 与 PageEditor 通用
- **功能**：页面分享复制链接按钮
- **功能**：Electron 桌面应用 2.0.0 重构
  - 架构从 loadURL 远程站点改为内置前端 + 纯 API 通信
  - 自定义深色标题栏（Logo + 刷新/关于按钮 + 原生最小化/最大化/关闭）
  - 左侧导航栏快速切换模块
  - OAuth 登录使用嵌入式 BrowserWindow

### 优化

- **样式**：4 个分散 @media 块合并为 1 个统一移动端响应式区块
- **样式**：小屏下 TOC 目录改为固定浮层覆在主内容上方
- **样式**：评论面板小屏全宽、悬浮按钮位置适配移动端
- **样式**：静态页面（用户协议/下载）移动端适配
- **样式**：工具栏按钮缩小、隐藏时间/类型列，防止小屏溢出
- **渲染**：PDF 渲染精度优化，defaultZoom 最小为 2x

### 修复

- **修复**：PageEditor 标题修改无法写入数据库（useCallback 闭包陷阱）
- **修复**：编辑器区域不跟随内容增高
- **修复**：后端 comments 路由兼容 pages 表的外键约束

### 部署

- **部署**：GitHub Actions 构建后自动创建 Release 并上传安装包

## v0.2.0 - 2026-08-03

- **初始化**：搭建北牖项目工程骨架（React 18 + Vite 5 + TypeScript）
- **功能**：集成 @doc-preview/react 文档查看器与明暗主题切换
- **功能**：实现文档列表与搜索筛选（关键词、类型、排序）
- **功能**：后端服务与存储层（Express + SQLite + 文档 CRUD + 静态托管）
- **功能**：前端统一 axios 客户端，对接后端 /api/documents 接口
- **功能**：OAuth 2.0 对接玄剑官网单点登录
  - 后端 oauth.js：玄剑 /api/oauth/verify 校验 + 60s 缓存
  - authMiddleware 同步本地 users 表（以 xuanjian_id 关联）
  - auth 路由：login / callback / me / logout
  - 前端 auth store、AuthCallback 页、UserMenu 组件
- **功能**：管理后台与分级权限
  - 后端 routes/admin.js：stats / users / documents 统计与管理
  - authMiddleware + adminMiddleware 保护（level >= 1）
  - 前端 RequireLevel 路由守卫、Admin 页面（统计卡片 + 文档/用户管理表格）
- **功能**：文档上传与详情管理
  - 七牛对象存储（bucket: northbooker，东南亚 as0 区域）
  - 前端直传七牛 + 后端回调记录模式，100MB 限制，需 level >= 1
  - XMLHttpRequest.upload.onprogress 真实上传进度回调
  - documents 路由增加 PUT 编辑标题接口
  - 前端 UploadDialog（拖拽 / 选择 / 进度条 / 记录中阶段提示）
  - 文档列表页集成上传按钮（管理员可见）
  - 管理后台文档表格增加重命名内联编辑
  - 删除文档时同步清理七牛对象存储文件
- **功能**：阅读体验增强
  - 查看页增加返回按钮、文档标题与元信息工具栏
  - 文档不存在状态独立卡片展示
  - 移动端响应式样式（导航 / 列表 / 查看页 / 管理后台 / 对话框）
- **文档**：完善 README（居中图标开头、徽章、OAuth 流程、API 一览）

### 权限体系

沿用玄剑官网用户等级：

| level | 含义 | 能力 |
|:---:|:---|:---|
| 0 | 普通用户 | 查看公开文档 |
| 1 | 管理员 | 管理后台、上传/管理文档 |
| 2 | 超级管理员 | 管理员全部权限 + 调整用户等级 |
| 3 | 最高级 | 全部权限 |

### OAuth 配置

- client_id：`northbooker`
- redirect_uri：`https://northbooker.xuanjian.top/api/auth/callback`
- Provider：https://www.xuanjian.top

### 对象存储配置

- 服务商：七牛云
- bucket：`northbooker`
- 区域：东南亚（as0）
- CDN 域名：`https://cdn.northbooker.xuanjian.top`
- 上传模式：前端直传 + 后端回调（带真实进度）

### 已知限制

- 玄剑官网需注册 client_id 与 redirect_uri 后 OAuth 流程方可联调
- 缩略图生成尚未实现（thumbnail 字段预留）
- 文档目录 / 书签等高级阅读功能待后续版本

## v0.2.0 - 2026-08-03

### 新增

- **功能**：一键转发 - 文档查看页添加复制链接按钮，自动生成【文档名】+URL 格式分享文本
- **功能**：书签收藏 - 用户可为文档添加/移除书签，列表页支持书签筛选，卡片右上角星星按钮快捷操作
- **功能**：文档评论 - 文档查看页集成评论区，支持发表/删除评论（Ctrl+Enter 快捷发送），本人及管理员可删除
- **功能**：Office 格式支持 - 新增 XLSX/CSV/PPTX 文件格式的上传与客户端渲染，Spreadsheet 自动表格预览，PPTX 幻灯片播放预览
- **功能**：PDF 查看器汉化 - CSS 覆层方案将 PDF 控件 tooltip 汉化（放大/缩小/适应宽度/适应页面/缩略图/搜索/打印/下载）
- **功能**：在线文档模块 - 基于 Tiptap 的富文本在线文档编辑器，独立的 /pages 模块
  - 后端 pages 表（id/title/content/parent_id/author_id/树形结构）
  - 前端 PageEditor 富文本编辑器（标题/H1-H3/加粗/斜体/下划线/删除线/高亮/引用/列表/任务列表/表格/链接/代码块）
  - 自动保存（Ctrl+S 手动保存 + 1.5s 防抖自动保存）
  - Pages 文档列表页（树形展示、新建、删除）
- **功能**：桌面版封装 - 新增 Electron 桌面应用目录，通过 webview 加载生产站点
- **部署**：GitHub Actions 工作流 - push 触发自动构建 Windows/macOS/Linux 三平台桌面应用

### 优化

- **样式**：明暗色模式统一度提升 - 新增 --color-danger / --color-success / --color-shadow / --color-overlay CSS 变量，替换全局硬编码颜色
- **样式**：移动端优化 - 工具栏仅显示图标、评论区高度调整、PDF 控件触摸友好尺寸
- **样式**：导航栏增加在线文档入口链接

