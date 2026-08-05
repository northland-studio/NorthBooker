<div align="center">
  <img src="./icon.png" width="200" height="200" alt="北牖 NorthBooker">
</div>

<div align="center">

# 北牖 NorthBooker

云端文档查看网站 · 由北域工作室开发

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![OAuth](https://img.shields.io/badge/OAuth-2.0-4A90D9)
![Tiptap](https://img.shields.io/badge/Tiptap-Rich%20Text-3182CE)
![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

![发布单位](https://img.shields.io/badge/发布单位-北域工作室-004AAD)
![主题](https://img.shields.io/badge/主题-明暗双主题-004AAD)
![状态](https://img.shields.io/badge/状态-开发中-orange)

</div>

---

## 项目简介

北牖（NorthBooker）是一个基于云端的文档查看网站，提供多格式文档在线预览、文档管理与分享能力。前端基于 React 与 doc-preview 渲染引擎，认证体系通过 OAuth 2.0 对接玄剑官网（xuanjian.top）单点登录，并沿用其分级权限模型。

- 开发单位：北域工作室（Northland Studio）
- 前端：React 18 + Vite 5 + TypeScript
- 后端：Node.js + Express + SQLite
- 文档渲染：@doc-preview/react
- 认证：OAuth 2.0 授权码模式（对接玄剑官网）

---

## 功能特性

- 多格式文档在线预览：PDF、DOCX、图片、Office（XLSX/CSV/PPTX）、文本、Markdown 等
- 在线文档编辑：基于 Tiptap 富文本编辑器，支持标题、列表、表格、代码块、任务列表等，自动保存
- 文档管理：拖拽上传（前端直传七牛，真实进度回调）、重命名、可见性控制、删除
- 单点登录：使用玄剑官网账号 OAuth 登录，无需另行注册
- 分级权限：基于玄剑用户等级（level 0-3）控制访问与后台管理
- 社交功能：一键转发分享链接、书签收藏、文档评论
- 管理后台：统计概览、文档管理、用户管理
- 明暗双主题：亮色（白 + #004AAD）/ 暗色（#1A1B1D + #004AAD）
- 桌面应用：Electron 封装（Windows/macOS/Linux），GitHub Actions 自动构建
- PWA 支持：manifest.json + iOS 主屏幕独立应用模式
- 下载页：动态版本号 + GitHub / CDN 双源分发
- 桌面端客制化：云字体预设、本地字体选择、系统托盘、开机启动、自定义主题色
- 全文搜索：跨在线文档 FTS5 索引 + 实时高亮
- 缩略图预览：PDF/Office 文件自动生成缩略图
- 标记读取：TTS 语音朗读在线文档（Edge 内置 / sherpa-onnx 离线音色模型，支持点哪从哪读）
- 朗读体验：离线模型多款可选 — AIShell3（174 音色）/ Theresa（804 音色）/ MeloTTS（中英双语 44100Hz），朗读时高亮当前句子并跟随滚动
- 长文朗读：四池并行流水线合成（上限 600 段），实时进度浮窗展示各池状态
- Android 客户端：React Native 原生三 Tab（文档 / 在线文档 / 设置），OAuth 单点登录，WebView 复用网页版查看器与编辑器
- Android 语音朗读：系统 TTS 开箱即用 + 离线模型（MeloTTS 中英双语 / Theresa 804 音色 / AIShell3 174 音色，仅 CDN 下载）
- Android 自动更新：更新元数据与 APK 仅通过七牛 CDN 分发，应用内检查 / 下载 / 系统安装器引导安装
- 批量操作：多选移动、删除文档 + 在线文档多选批量删除
- 右键菜单：文档列表 + 在线文档列表支持右键操作
- 文档版本历史：自动快照 + 回滚
- 密码分享：带密码和过期的分享链接
- 更新通知：WebSocket 实时推送 + 系统原生通知
- 响应式布局，适配桌面与移动端

---

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 前端框架 | React 18 |
| 构建工具 | Vite 5 |
| 类型系统 | TypeScript 5 |
| 路由 | React Router 6 |
| 状态管理 | Zustand |
| 请求库 | Axios |
| 文档渲染 | @doc-preview/react |
| 富文本编辑 | Tiptap (ProseMirror) |
| 桌面封装 | Electron 31 |
| Android 客户端 | React Native 0.86 + TypeScript |
| Android 导航 | React Navigation（原生栈 + 底部 Tab） |
| Android 内嵌 | react-native-webview（查看器 / 编辑器 / OAuth） |
| Android 离线 TTS | react-native-sherpa-onnx（libarchive 解压 + ONNX 推理） |
| Android 文件 | @dr.pogodin/react-native-fs |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 对象存储 | 七牛云（东南亚 as0 区域，bucket: northbooker） |
| 认证 | OAuth 2.0（玄剑官网签发 access_token） |

---

## 项目结构

```
northbooker/
├── src/                       # 前端源码
│   ├── api/                   # 接口请求封装（client、documents、auth、admin、uploads、bookmarks、comments、pages）
│   ├── components/            # 通用组件（Layout、Navbar、UserMenu、UploadDialog、RequireLevel、BookmarkButton、CommentSection 等）
│   ├── pages/                 # 页面（Documents、Viewer、Admin、AuthCallback、Pages、PageEditor）
│   ├── store/                 # 状态管理（theme、auth）
│   ├── styles/                # 全局样式
│   ├── types/                 # 类型定义（document、user）
│   ├── utils/                 # 工具函数（fileType）
│   ├── App.tsx                # 根组件与路由
│   └── main.tsx               # 应用入口
├── server/                    # 后端服务
│   ├── src/
│   │   ├── middleware/        # 认证与权限中间件
│   │   ├── routes/            # 路由（documents、auth、admin、uploads、bookmarks、comments、pages、folders）
│   │   ├── utils/             # 后端工具（fileType）
│   │   ├── app.js             # Express 应用
│   │   ├── database.js        # SQLite 初始化与示例数据
│   │   ├── index.js           # 服务入口
│   │   ├── oauth.js           # 玄剑 OAuth 配置
│   │   └── qiniu.js           # 七牛对象存储配置
│   ├── data/                  # SQLite 数据库目录
│   └── .env.example
├── electron/                  # Electron 桌面版（v2.5.1 内置前端架构）
│   ├── main.js                # Electron 主进程
│   ├── preload.js             # 预加载脚本（contextBridge）
│   ├── tts.js                 # TTS 离线合成（模型管理 + 段落切分 + node.exe 子进程池）
│   ├── tts-worker.js          # TTS 推理子进程（sherpa-onnx）
│   ├── upload-tts-models.js   # 上传 TTS 模型到七牛 CDN
│   ├── release-notes.json     # 更新说明（同步到 CDN）
│   ├── renderer/              # 内置前端（自定义标题栏 + 侧边导航）
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   └── package.json           # 桌面版依赖（electron-builder）
├── Android/                   # Android 客户端（v1.0.0，React Native 0.86）
│   ├── App.tsx                # 导航根（原生栈 + 底部 Tab + 登录门禁）
│   ├── src/
│   │   ├── api/               # 接口封装（client 统一 token / documents / updates）
│   │   ├── components/        # 通用组件（FileIcon SVG 图标）
│   │   ├── screens/           # 页面（Documents / Pages / Viewer / PageEditor / Login / TtsSettings / Update / Settings）
│   │   ├── store/             # 状态（auth / settings 主题与 TTS 偏好）
│   │   ├── tts/               # 朗读引擎（系统 TTS / sherpa 离线，模型仅 CDN 下载）
│   │   ├── update/            # 自动更新（CDN latest.json + APK 下载安装）
│   │   ├── config.ts          # API 地址 / CDN 代理 / 版本常量
│   │   └── theme.ts           # 明暗主题（白 + #004AAD / #1A1B1D + #004AAD）
│   ├── scripts/publish-to-cdn.js # 发布 APK + latest.json 到七牛 CDN
│   └── android/               # Gradle 工程（com.northbooker，含原生模块：系统 TTS / WAV 播放 / APK 安装）
├── public/                    # 前端静态资源与示例文档
│   └── manifest.json          # PWA 清单
├── .github/workflows/         # GitHub Actions 构建流水线
│   └── build-electron.yml     # 自动构建三平台桌面应用
├── index.html                 # HTML 入口
├── vite.config.ts             # Vite 配置
└── package.json               # 依赖与脚本
```

---

## 快速开始

### 环境要求

- Node.js >= 18（需内置全局 fetch）
- npm >= 9

### 安装与开发

```bash
# 1. 安装前端依赖
npm install

# 2. 安装后端依赖
cd server
npm install
cd ..

# 3. 配置后端环境变量
cp server/.env.example server/.env
# 编辑 server/.env，填写 OAUTH_CLIENT_SECRET 等

# 4. 启动后端服务（默认 3000 端口）
cd server
npm run dev

# 5. 启动前端开发服务器（新终端，默认 5173 端口）
npm run dev
```

前端开发服务器已配置代理，`/api` 与 `/uploads` 请求会自动转发到 `http://localhost:3000`。

### 构建与预览

```bash
# 类型检查并构建生产产物
npm run build

# 本地预览构建产物
npm run preview
```

### 代码检查

```bash
npm run lint     # ESLint 检查
npm run format   # Prettier 格式化
```

---

## 环境变量

### 前端

前端仅需配置 API 基础地址，OAuth 敏感信息全部由后端处理：

```bash
# .env（Vite，需 VITE_ 前缀）
VITE_API_BASE_URL=/api
```

### 后端

后端环境变量位于 `server/.env`，参考 `server/.env.example`：

```bash
PORT=3000
JWT_SECRET=change_me_in_production

# 玄剑官网 OAuth
OAUTH_PROVIDER_URL=https://www.xuanjian.top
OAUTH_CLIENT_ID=northbooker
OAUTH_CLIENT_SECRET=              # 由玄剑官网注册分配
OAUTH_REDIRECT_URI=https://northbooker.xuanjian.top/api/auth/callback

# 七牛对象存储（东南亚 as0 区域）
QINIU_ACCESS_KEY=                 # 七牛 AccessKey
QINIU_SECRET_KEY=                 # 七牛 SecretKey
QINIU_BUCKET=northbooker
QINIU_CDN_DOMAIN=https://cdn.northbooker.xuanjian.top
```

> 开发环境下可将 `OAUTH_REDIRECT_URI` 设为 `http://localhost:5173/api/auth/callback`，并确保玄剑官网注册的 redirect_uri 允许该地址。

---

## OAuth 对接玄剑官网

北牖作为 OAuth Client，对接玄剑官网（https://www.xuanjian.top）作为 OAuth Provider，采用授权码模式实现单点登录。

### 授权流程

```
北牖前端 ──1. GET /api/auth/login──> 北牖后端 ──302──> 玄剑 /api/oauth/authorize
                                                                │
                                                          2. 用户登录并同意授权
                                                                │
北牖后端 <──3. 回调带 code──────────────────────── 玄剑官网
   │
   ├──4. POST /api/oauth/token 换 access_token ──> 玄剑
   ├──5. GET /api/oauth/verify 校验并获取用户信息 ──> 玄剑
   └──6. 302 重定向到前端 /callback#access_token=xxx
          前端写入 localStorage，调用 /api/auth/me 拉取本地用户
```

### 玄剑 OAuth 端点

| 端点 | 方法 | 说明 |
|:---|:---|:---|
| `/api/oauth/authorize` | GET | 授权确认页 |
| `/api/oauth/authorize` | POST | 生成授权码（5 分钟有效） |
| `/api/oauth/token` | POST | 授权码换访问令牌（7 天有效） |
| `/api/oauth/verify` | GET | 校验访问令牌并返回用户信息 |
| `/api/oauth/userinfo` | GET | 获取用户详细信息 |

### 北牖后端认证接口

| 接口 | 方法 | 说明 |
|:---|:---|:---|
| `/api/auth/login` | GET | 跳转玄剑授权页（带 state 防 CSRF） |
| `/api/auth/callback` | GET | 授权回调，用 code 换 token 后重定向前端 |
| `/api/auth/me` | GET | 返回当前登录用户（需 Bearer token） |
| `/api/auth/logout` | POST | 登出并清除后端 token 缓存 |

### 权限等级体系

北牖沿用玄剑官网的用户等级模型，用于控制管理后台与文档管理访问：

| level | 含义 | 能力 |
|:---:|:---|:---|
| 0 | 普通用户 | 查看公开文档 |
| 1 | 管理员 | 进入管理后台、上传/管理文档、查看用户列表 |
| 2 | 超级管理员 | 管理员全部权限 + 调整用户等级 |
| 3 | 最高级 | 全部权限 |

### OAuth 客户端配置

- client_id：`northbooker`（自定）
- redirect_uri：`https://northbooker.xuanjian.top/api/auth/callback`
- token 校验：北牖后端调用玄剑 `/api/oauth/verify` 校验，结果缓存 60 秒以减少远程调用
- 用户同步：首次校验通过后，用户信息会同步到北牖本地 `users` 表（以 `xuanjian_id` 关联）

---

## 对象存储与上传流程

文档文件存储于七牛云对象存储（bucket: `northbooker`，区域：东南亚 as0，CDN：`cdn.northbooker.xuanjian.top`）。采用**前端直传 + 后端回调**模式，文件不经后端中转，节省服务器带宽并获取真实上传进度。

### 上传流程

```
前端 ──1. GET /api/uploads/token?fileName=xxx──> 后端（返回 uploadToken + key）
  │
  ├──2. XMLHttpRequest 直传 https://up-as0.qiniup.com（token/key/file）
  │      └─ xhr.upload.onprogress 实时回调进度（0-100%）
  │
  └──3. POST /api/uploads/callback（key/fileName/size/hash）──> 后端记录文档
```

- 上传凭证由后端签发（1 小时有效），含 `returnBody` 返回 key/hash/fsize
- 前端用 `XMLHttpRequest.upload.onprogress` 获取真实上传进度
- 上传成功后前端回调后端，写入 `documents` 表，uri 为 CDN 完整地址
- 管理后台删除文档时，后端同步调用七牛删除接口清理对象存储文件

---

## 路由与页面

| 路径 | 页面 | 权限 |
|:---|:---|:---|
| `/` | 文件托管（含文件夹导航/书签筛选） | 公开 |
| `/viewer/:id` | 文档查看（含评论、转发、书签） | 公开 |
| `/pages` | 在线文档列表 | 公开 |
| `/pages/:id` | 在线文档编辑器 | 登录后可编辑 |
| `/download` | 应用下载 | 公开 |
| `/terms` | 用户协议 | 公开 |
| `/callback` | OAuth 回调处理 | 公开 |
| `/admin` | 管理后台 | 需登录且 level >= 1 |

---

## 后端 API 一览

| 接口 | 方法 | 权限 | 说明 |
|:---|:---|:---|:---|
| `/api/health` | GET | 公开 | 健康检查 |
| `/api/documents` | GET | 公开 | 文档列表 |
| `/api/documents/:id` | GET | 公开 | 单个文档 |
| `/api/documents/:id` | PUT | level >= 1 | 编辑标题 |
| `/api/auth/login` | GET | 公开 | 跳转授权 |
| `/api/auth/callback` | GET | 公开 | 授权回调 |
| `/api/auth/me` | GET | 登录 | 当前用户 |
| `/api/auth/logout` | POST | 公开 | 登出 |
| `/api/uploads/token` | GET | level >= 1 | 获取七牛上传凭证（前端直传） |
| `/api/uploads/callback` | POST | level >= 1 | 上传完成后记录文档 |
| `/api/uploads` | DELETE | level >= 1 | 删除七牛文件 |
| `/api/admin/stats` | GET | level >= 1 | 统计信息 |
| `/api/admin/documents` | GET | level >= 1 | 文档管理列表 |
| `/api/admin/users` | GET | level >= 1 | 用户列表 |
| `/api/admin/documents/:id/visibility` | PUT | level >= 1 | 切换可见性 |
| `/api/admin/documents/:id` | DELETE | level >= 1 | 删除文档（同步清理七牛） |
| `/api/bookmarks` | GET | 登录 | 获取书签列表 |
| `/api/bookmarks/check/:docId` | GET | 登录 | 检查文档是否已收藏 |
| `/api/bookmarks/:docId` | POST | 登录 | 添加书签 |
| `/api/bookmarks/:docId` | DELETE | 登录 | 移除书签 |
| `/api/comments/:docId` | GET | 公开 | 获取评论列表 |
| `/api/comments/:docId` | POST | 登录 | 发表评论 |
| `/api/comments/:id` | DELETE | 登录 | 删除评论（本人/管理员） |
| `/api/pages/tree` | GET | 公开 | 获取页面树 |
| `/api/pages/:id` | GET | 公开 | 获取页面 |
| `/api/pages` | POST | 登录 | 创建页面 |
| `/api/pages/:id` | PUT | 登录 | 更新页面（作者/管理员） |
| `/api/pages/:id` | DELETE | 登录 | 删除页面（作者/管理员） |
| `/api/folders` | GET | 公开 | 获取文件夹列表（支持 parent_id 过滤） |
| `/api/folders` | POST | level >= 1 | 创建文件夹 |
| `/api/folders/:id` | DELETE | level >= 1 | 删除文件夹（级联清理子文档） |
| `/api/search` | GET | 公开 | 全文搜索（文档 + 在线文档） |
| `/api/subscriptions` | GET/POST/DELETE | 登录 | 文档订阅管理 |
| `/api/share` | POST | 登录 | 创建密码分享链接 |
| `/api/share/:token` | GET | 公开 | 验证分享链接 |
| `/api/share/:token/verify` | POST | 公开 | 密码验证获取文档 |
| `/api/pages/:id/versions` | GET | 公开 | 获取版本历史 |
| `/api/pages/:id/versions/:vid/restore` | POST | 登录 | 回滚到指定版本 |

---

## 提交规范

提交信息使用中文，前缀如下：

| 前缀 | 用途 |
|:---|:---|
| 初始化 | 项目初始化 |
| 功能 | 新增功能 |
| 修复 | 修复缺陷 |
| 样式 | 界面与样式调整 |
| 重构 | 代码重构 |
| 文档 | 文档更新 |
| 部署 | 部署相关 |

示例：`功能: OAuth 对接玄剑官网单点登录`

---
## 桌面版

北牖提供基于 Electron 的桌面客户端，采用内置本地 HTTP 服务器 + Vite 构建前端架构，通过代理访问生产 API。支持自动更新（GitHub + CDN 双源）、云字体、系统托盘、窗口记忆等客制化功能。

离线 TTS 语音合成在桌面端本地运行：内置 node.exe 独立子进程执行 sherpa-onnx 推理（AIShell3 / Theresa / MeloTTS 模型按需下载，GitHub + 七牛 CDN 双源），支持音色切换、朗读句子高亮与四池并行长文合成。

### 构建桌面应用

```bash
cd electron
npm install
npm run build
```

构建产物位于 `electron/dist/`，包含 Windows (.exe NSIS 安装包)、macOS (.dmg)、Linux (.AppImage / .deb)。

### 自动更新

桌面版启动 5 秒后自动检查更新，发现新版本时在右下角显示通知卡片（下载进度 + 完成操作）。GitHub Releases 为主源，Qiniu CDN 为备用源。

### CI/CD 自动构建

推送至 `main` 分支（`electron/` 目录有变更）或手动触发工作流，GitHub Actions 自动构建并上传三平台安装包至 GitHub Releases 与 Qiniu CDN。

---
## Android 版

北牖提供基于 React Native 的 Android 客户端（`Android/` 目录），原生三 Tab 结构：文档（托管文件列表）、在线文档（页面树）、设置。文档查看器与在线文档编辑器复用网页版（react-native-webview 内嵌，自动注入登录态）。

**下载仅使用 CDN**：Android 端所有运行时下载（离线 TTS 模型、APK 更新包）一律走七牛私有空间签名 URL（经 `https://northbooker.xuanjian.top/api/updates/files/...` 服务器代理），不依赖 GitHub Releases。

### 构建 Android 应用

```bash
cd Android
npm install
# 生成调试 APK
cd android && ./gradlew assembleDebug
# 生成发布 APK（本地无 keystore 时用 debug 签名）
cd android && ./gradlew assembleRelease
```

### 自动更新（仅 CDN）

- 更新元数据：`GET /api/updates/android/latest.json`（服务器从七牛 `releases/android/latest.json` 读取）
- APK 下载：`GET /api/updates/files/android/<apk>` → 302 到七牛签名 URL（仅 CDN）
- 应用内：设置 → 检查更新 → 下载进度 → 系统安装器引导安装（`REQUEST_INSTALL_PACKAGES` + FileProvider）
- 发布：`node Android/scripts/publish-to-cdn.js --apk <app-release.apk>` 自动生成并上传 `latest.json` 与 APK

### CI/CD 自动构建

推送至 `main` 分支（`Android/` 目录有变更）或手动触发，`.github/workflows/build-android.yml` 构建 release APK 并自动发布到七牛 CDN 更新源。建议在 GitHub Secrets 配置稳定签名密钥（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`），保证跨版本更新安装时签名一致；未配置时使用 debug 签名。

---

## 部署

- 前端：`npm run build` 产物部署至静态服务器或 CDN
- 后端：Node.js 服务部署至服务器，反向代理指向 3000 端口
- 域名：northbooker.xuanjian.top
- 文件传输：使用 scp 上传至服务器（不通过 git）
- 详细部署配置见批次10

---

## 开发单位

北域工作室（Northland Studio）

## 许可证

MIT License
