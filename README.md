# 北牖 NorthBooker

![icon](./icon.png)

> 云端文档查看网站 · 由北域工作室开发

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 项目简介

北牖（NorthBooker）是一个基于云端的文档查看网站，提供多格式文档在线预览、文档管理与分享能力。前端基于 React 与 doc-preview 渲染引擎，认证体系通过 OAuth 2.0 对接玄剑官网（xuanjian.top）单点登录，并沿用其分级权限模型。

- 开发单位：北域工作室
- 前端：React 18 + Vite 5 + TypeScript
- 后端：Node.js + Express + SQLite
- 文档渲染：@doc-preview/react
- 认证：OAuth 2.0 授权码模式（对接玄剑官网）

---

## 功能特性

- 多格式文档在线预览：PDF、DOCX、图片、Office、文本、Markdown 等
- 文档管理：上传、分类、可见性控制、分享链接
- 单点登录：使用玄剑官网账号 OAuth 登录
- 分级权限：基于玄剑用户等级（level 0-3）控制访问
- 管理后台：文档管理、用户管理、统计概览
- 明暗双主题：亮色（白 + #004AAD）/ 暗色（#1A1B1D + #004AAD）
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
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| 认证 | OAuth 2.0 + JWT |

---

## 项目结构

```
northbooker/
├── src/                    # 前端源码
│   ├── api/                # 接口请求封装
│   ├── components/         # 通用组件
│   ├── hooks/              # 自定义 Hooks
│   ├── pages/              # 页面组件
│   ├── store/              # 状态管理
│   ├── styles/             # 全局样式
│   ├── types/              # 类型定义
│   ├── utils/              # 工具函数
│   ├── App.tsx             # 根组件与路由
│   ├── main.tsx            # 应用入口
│   └── vite-env.d.ts       # 环境变量类型
├── server/                 # 后端服务（批次4起）
├── public/                 # 静态资源
├── index.html              # HTML 入口
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── eslint.config.js        # ESLint 配置
├── .prettierrc             # Prettier 配置
└── package.json            # 依赖与脚本
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与开发

```bash
# 安装依赖
npm install

# 启动前端开发服务器（默认 5173 端口）
npm run dev

# 启动后端服务（批次4起，默认 3000 端口）
cd server
npm install
npm run dev
```

### 构建与预览

```bash
# 类型检查并构建生产产物
npm run build

# 本地预览构建产物
npm run preview
```

### 代码检查

```bash
# ESLint 检查
npm run lint

# 格式化代码
npm run format
```

---

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

```bash
# 前端（Vite，需 VITE_ 前缀）
VITE_OAUTH_PROVIDER_URL=https://www.xuanjian.top
VITE_OAUTH_CLIENT_ID=northbooker
VITE_OAUTH_REDIRECT_URI=https://northbooker.xuanjian.top/callback
VITE_API_BASE_URL=/api
```

后端环境变量位于 `server/.env`，详见后端目录说明。

---

## OAuth 对接玄剑官网

北牖作为 OAuth Client，对接玄剑官网（https://www.xuanjian.top）作为 OAuth Provider，采用授权码模式实现单点登录。

### 授权流程

```
北牖前端 ──1. 跳转授权──> 玄剑官网 /api/oauth/authorize
                              │
                          2. 用户登录并同意授权
                              │
北牖回调 <──3. 回调带 code──── 玄剑官网
   │
   └──4. 后端用 code 换 access_token ──> /api/oauth/token
   └──5. 用 token 获取用户信息 ───────> /api/oauth/userinfo
   └──6. 签发北牖本地会话
```

### OAuth 端点

| 端点 | 方法 | 说明 |
|:---|:---|:---|
| `/api/oauth/authorize` | GET | 授权确认页 |
| `/api/oauth/authorize` | POST | 生成授权码（5 分钟有效） |
| `/api/oauth/token` | POST | 授权码换访问令牌（7 天有效） |
| `/api/oauth/verify` | GET | 校验访问令牌 |
| `/api/oauth/userinfo` | GET | 获取用户信息 |

### 权限等级体系

北牖沿用玄剑官网的用户等级模型，用于控制管理后台访问：

| level | 含义 | 能力 |
|:---:|:---|:---|
| 0 | 普通用户 | 查看文档 |
| 1 | 管理员 | 进入管理后台、管理文档与用户 |
| 2 | 超级管理员 | 管理员全部权限 + 调整用户等级 |
| 3 | 最高级 | 全部权限 |

### OAuth 客户端配置

- client_id：`northbooker`
- redirect_uri：`https://northbooker.xuanjian.top/callback`

> 说明：玄剑官网当前未启用 client_secret 校验与客户端白名单，client_id 为约定值。生产环境建议推动玄剑方补齐白名单与密钥校验。

---

## 路由与页面

| 路径 | 页面 | 权限 |
|:---|:---|:---|
| `/` | 文档列表 | 公开 |
| `/viewer/:id` | 文档查看 | 公开/登录 |
| `/login` | 登录（跳转玄剑 OAuth） | 公开 |
| `/callback` | OAuth 回调 | 公开 |
| `/admin` | 管理后台 | level >= 1 |
| `/admin/users` | 用户管理 | level >= 2 |

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

示例：`功能: 实现文档列表与搜索筛选`

---

## 部署

- 前端：`npm run build` 产物部署至静态服务器或 CDN
- 后端：Node.js 服务部署至服务器，反向代理指向 3000 端口
- 域名：northbooker.xuanjian.top
- 详细部署文档将在批次10补充

---

## 开发单位

北域工作室（Northland Studio）

## 许可证

MIT License
