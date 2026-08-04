# 北牖 2.3.0 重大功能更新 Spec

## Why
当前北牖已具备基础文档托管、在线编辑、桌面端能力，但在搜索、协作、安全分享等方面存在明显短板。本次更新聚焦 9 项高频需求，覆盖网页端和桌面端，大幅提升产品完整度。

## What Changes
- 在线文档全文搜索修复 — 修复已有 ProseMirror 搜索，扩展为跨文档全文索引
- 缩略图预览 — PDF/Office 首页缩略图生成与展示
- 批量操作 — 多选移动、删除文档/文件夹
- Markdown 在线编辑器 — 在线文档模块新增 Markdown 编辑模式
- 文档版本历史 — 编辑自动保存版本快照，支持回滚
- 文档协作 — 多人实时编辑（WebSocket）
- 文档订阅/RSS — 关注文档变动 + Electron 原生通知
- 私有文件密码分享 — 生成带密码/过期时间的分享链接
- 桌面端自定义主题色 — 替换固定蓝色主色调为用户自选色

## Impact
- Affected specs: 无（新功能）
- Affected code:
  - 前端: `src/pages/PageEditor.tsx`, `src/pages/Viewer.tsx`, `src/pages/Documents.tsx`, `src/components/*`
  - 后端: `server/src/routes/pages.js`, `server/src/database.js`, 新增路由
  - Electron: `electron/main.js`, `electron/preload.js`
  - 样式: `src/styles/index.css`

---

## ADDED Requirements

### Requirement 1: 全文搜索
系统 SHALL 提供跨在线文档的全文搜索能力，基于 SQLite FTS5 建立内容索引。用户输入关键词可搜索所有在线文档正文，结果高亮匹配文本并按相关度排序。

#### Scenario: 全文搜索成功
- **WHEN** 用户在搜索栏输入关键词并提交
- **THEN** 返回匹配的文档列表，每条结果显示标题、匹配片段（高亮关键词）、相关度

#### Scenario: 无匹配结果
- **WHEN** 搜索无匹配
- **THEN** 显示"未找到相关文档"

### Requirement 2: 缩略图预览
系统 SHALL 为 PDF 和 Office 文档自动生成首页缩略图，在文件列表（网格/列表视图）中展示。缩略图在上传后异步生成，存储在七牛云。

#### Scenario: PDF 缩略图生成
- **WHEN** 管理员上传 PDF 文件
- **THEN** 后端调用 PDF 渲染库生成首页缩略图，上传七牛，更新 documents 表 thumbnail 字段

#### Scenario: 列表页展示缩略图
- **WHEN** 用户浏览文档列表
- **THEN** 网格视图卡片显示文档缩略图占位，加载完成后替换

### Requirement 3: 批量操作
系统 SHALL 支持用户在文档/文件夹列表中进行多选，并提供批量移动至文件夹和批量删除操作。

#### Scenario: 批量移动
- **WHEN** 用户勾选多个文档，点击"移动到文件夹"，选择目标文件夹
- **THEN** 所选文档批量更新 folder_id

#### Scenario: 批量删除
- **WHEN** 用户勾选多个文档，点击"删除选中"，确认弹窗
- **THEN** 所选文档批量删除（含七牛文件清理）

### Requirement 4: Markdown 编辑器
在线文档编辑器 SHALL 支持 Markdown 编辑模式。用户可在新建页面时选择 Markdown 类型，编辑区支持 Markdown 语法高亮和实时预览。

#### Scenario: 创建 Markdown 文档
- **WHEN** 用户新建在线文档并选择 Markdown 类型
- **THEN** 打开分栏编辑器（左侧 Markdown 源码，右侧实时渲染预览）

#### Scenario: 切换编辑器模式
- **WHEN** 用户在编辑器中点击"切换为富文本"
- **THEN** 内容转换为 Tiptap 富文本格式

### Requirement 5: 版本历史
在线文档 SHALL 在每次保存时自动创建版本快照。用户可查看版本历史列表，对比两个版本差异，或将文档回滚到历史版本。

#### Scenario: 自动创建版本
- **WHEN** 用户编辑在线文档并保存（手动或自动）
- **THEN** 系统在 page_versions 表中插入一条记录（snapshot JSON）

#### Scenario: 回滚版本
- **WHEN** 用户选择某个历史版本并点击"恢复到此版本"
- **THEN** 当前内容替换为该版本快照，同时创建新版本记录（标记为回滚操作）

### Requirement 6: 文档协作
在线文档 SHALL 支持多人实时协作编辑。同一文档的多位编辑者通过 WebSocket 连接，操作通过 OT/CRDT 同步。

#### Scenario: 多人同时编辑
- **WHEN** 用户 A 和用户 B 同时编辑同一在线文档
- **THEN** 双方看到实时的对方编辑内容，光标位置标识用户名

#### Scenario: 协作者指示
- **WHEN** 文档有其他人正在编辑
- **THEN** 编辑器顶部显示在线协作者头像列表

### Requirement 7: 文档订阅与通知
系统 SHALL 支持用户订阅指定文档或文件夹的变动通知。文档有编辑或新文档添加时，桌面端通过 Electron Notification API 推送系统原生通知。

#### Scenario: 订阅文档
- **WHEN** 用户在文档查看页点击"订阅更新"
- **THEN** 记录订阅关系，后续该文档变动时推送通知

#### Scenario: 接收通知
- **WHEN** 已订阅文档被他人编辑
- **THEN** 桌面端弹出系统通知："xxx 更新了文档《yyy》"

### Requirement 8: 密码分享
系统 SHALL 支持为私有文档生成带密码保护和时间过期的分享链接。访问者需输入正确密码并在有效期内才能查看。

#### Scenario: 生成分享链接
- **WHEN** 用户对私有文档点击"生成分享链接"，设置密码和过期时间
- **THEN** 系统生成唯一 token，返回 `northbooker.xuanjian.top/share/{token}`

#### Scenario: 验证分享链接
- **WHEN** 访问者打开分享链接
- **THEN** 显示密码输入页；密码正确且在有效期内则展示文档

### Requirement 9: 桌面端自定义主题色
Electron 桌面应用 SHALL 允许用户在设置中自选主题色，替换默认的 #004AAD 蓝色。选择后通过 CSS 变量动态注入。

#### Scenario: 更改主题色
- **WHEN** 用户在设置面板的颜色选择器中选择新主题色（如红色 #E74C3C）
- **THEN** 所有使用 --color-primary 的 UI 元素立即更新为所选颜色

#### Scenario: 主题色持久化
- **WHEN** 用户关闭并重启应用
- **THEN** 之前选择的主题色保持不变

---

## MODIFIED Requirements

### Requirement: 现有下载路由文档更新
CHANGELOG.md、README.md、release-notes.json SHALL 更新以反映 2.3.0 新增功能。

### Requirement: 在线文档编辑器 (MODIFIED)
现有 Tiptap 富文本编辑器 SHALL 新增 Markdown 编辑模式，保留原有富文本模式不变。

### Requirement: 搜索功能 (MODIFIED)
现有 ProseMirror 文档内搜索 SHALL 保留；新增跨文档全文搜索作为独立入口。

---

## REMOVED Requirements
无。
