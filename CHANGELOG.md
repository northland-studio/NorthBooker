# 北牖 NorthBooker 更新日志

本文件记录北牖（NorthBooker）项目的版本演进与变更内容。
发布单位：北域工作室（Northland Studio）

## v0.1.0 - 2026-08-03

首个可用版本，完成核心文档查看、OAuth 单点登录与管理后台能力。

### 新增

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

