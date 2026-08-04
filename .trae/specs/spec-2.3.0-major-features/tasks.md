# Tasks

## 并行任务组 A（后端基础设施，无相互依赖）

- [ ] Task 1: 全文搜索后端 — SQLite FTS5 索引 + 搜索 API
  - 在 database.js 中创建 page_fts 虚拟表，对 pages.content 建 FTS5 索引
  - 创建 routes/search.js，`GET /api/pages/search?q=keyword` 返回匹配文档列表（含匹配片段、相关度排序）
  - 在 app.js 挂载 search 路由
  - 在页面编辑保存时同步更新 FTS 索引

- [ ] Task 2: 缩略图后端 — PDF 缩略图生成
  - 安装 pdf-thumbnail 或使用 canvas 方案在后端生成 PDF 首页缩略图
  - 新增 `POST /api/documents/:id/thumbnail` 或在上传回调中异步触发
  - 缩略图上传七牛，更新 documents.thumbnail 字段
  - 前端 documents API 返回中携带 thumbnail URL

- [ ] Task 3: 版本历史后端 — page_versions 表 + API
  - database.js 创建 page_versions 表（id, page_id, content, title, created_at, author_id, is_rollback）
  - 修改 pages 路由 PUT 保存逻辑：每次更新前先插入一条版本快照
  - 新增 `GET /api/pages/:id/versions` 返回版本列表
  - 新增 `POST /api/pages/:id/versions/:versionId/restore` 回滚到指定版本

- [ ] Task 4: 密码分享后端 — share_links 表 + API
  - database.js 创建 share_links 表（id, doc_id, token, password_hash, expires_at, created_by）
  - 新增 routes/share.js：POST 创建分享链接、GET 验证 token 和密码、GET 获取文档内容
  - 密码使用 bcryptjs 哈希存储

- [ ] Task 5: 订阅通知后端 — subscriptions 表 + API + WebSocket 推送
  - database.js 创建 subscriptions 表（id, user_id, target_type, target_id）
  - 新增 routes/subscriptions.js：POST 订阅、DELETE 取消、GET 我的订阅
  - 在文档/页面编辑保存时，查询订阅者并通过 WebSocket 推送通知事件
  - Electron 主进程监听 WebSocket 事件，调用 Notification API 弹出系统通知

## 并行任务组 B（前端页面级功能，依赖对应后端接口）

- [ ] Task 6: 全文搜索前端
  - Documents 页（或独立搜索页）新增全局搜索栏
  - 搜索结果列表组件（展示标题、匹配片段高亮、文档类型图标）
  - 点击结果跳转到对应文档/在线文档的查看页

- [ ] Task 7: 缩略图前端
  - DocumentCard 组件展示 thumbnail 图片（有缩略图时替代图标，加载中显示骨架屏）
  - 列表视图在文件名旁显示小缩略图
  - 上传成功后自动触发缩略图生成（轮询或 WebSocket 通知）

- [ ] Task 8: 批量操作前端
  - Documents 页工具栏新增"选择模式"切换按钮
  - 文档卡片/列表行新增复选框
  - 选择模式下底部浮现操作栏："移动到文件夹"、"删除选中"
  - 批量移动时弹出文件夹选择器
  - 批量删除前确认弹窗

- [ ] Task 9: Markdown 编辑器
  - PageEditor 新增编辑器类型切换（富文本 / Markdown）
  - Markdown 模式：左侧代码编辑区（带语法高亮 CodeMirror 或简易 textarea），右侧实时渲染预览
  - pages 表新增 editor_type 字段（richtext/markdown）
  - 保存/加载时正确处理两种格式

- [ ] Task 10: 版本历史前端
  - PageEditor 工具栏新增"版本历史"按钮
  - 版本列表面板：时间线展示各版本（时间、作者、是否为回滚）
  - 点击版本预览该版本内容
  - "恢复到此版本"按钮（确认弹窗）

- [ ] Task 11: 密码分享前端
  - 文档查看页/Viewe 页对私有文档显示"生成分享链接"按钮
  - 弹窗设置密码（可选）和过期时间（1h/1d/7d/永久）
  - 生成后显示可复制链接
  - 分享链接访问页：密码输入 → 验证 → 文档查看

- [ ] Task 12: 文档订阅前端
  - 文档查看页/在线文档查看页显示"订阅更新"按钮（铃铛图标）
  - 已订阅状态高亮，点击取消订阅
  - 在线文档编辑保存时通过 WebSocket 向订阅者推送

## 顺序任务组 C（桌面端专属，依赖 Task 5）

- [ ] Task 13: 桌面端自定义主题色
  - SettingsPanel 新增颜色选择器（预设几组颜色 + 自定义色值输入）
  - electron-store 新增 themeColor 字段
  - set-setting IPC 在设置主题色时通过 executeJavaScript 注入 CSS 变量 `--color-primary` 和 `--color-primary-hover`
  - 主题色变更立即生效，重启后保持

- [ ] Task 14: Electron 原生通知（依赖 Task 5）
  - main.js 连接 WebSocket 服务监听订阅通知
  - 收到订阅事件时调用 Notification API 弹出系统通知
  - 通知点击时聚焦主窗口并跳转到对应文档

## 文档任务组 D

- [ ] Task 15: 更新 CHANGELOG.md、README.md、release-notes.json
  - CHANGELOG 新增 v2.3.0 条目
  - README 功能特性区新增 9 项功能描述
  - release-notes.json 更新为 2.3.0 内容

## 部署任务组 E

- [ ] Task 16: 构建 + 部署 + 版本号
  - electron/package.json 版本升至 2.3.0
  - 前端构建 + 部署 dist 到服务器
  - 后端部署（database.js 迁移 + 新路由 + pm2 重启）
  - 提交推送

# Task Dependencies
- Task 6-8 可并行，各自依赖对应后端 Task 1-5
- Task 9-12 可并行，各自依赖对应后端 Task 1-5
- Task 13 独立，不依赖其他任务
- Task 14 依赖 Task 5（WebSocket 基础设施）
- Task 15-16 在所有功能完成后执行
- Task 组 A（1-5）应最先执行，可全部并行
