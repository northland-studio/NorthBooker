import { useState } from 'react'
import { Link } from 'react-router-dom'

// 目录数据结构：一级 = 页面标题，二级 = 章节（h2），三级 = 小节（h3）
interface GuideItem {
  id: string
  title: string
}
interface GuideSection {
  id: string
  title: string
  items: GuideItem[]
}

const SECTIONS: GuideSection[] = [
  {
    id: 'quickstart',
    title: '1. 快速开始',
    items: [
      { id: 'qs-what', title: '什么是北牖' },
      { id: 'qs-login', title: '账号登录' },
      { id: 'qs-platform', title: '网页版与桌面版' },
    ],
  },
  {
    id: 'files',
    title: '2. 文件托管',
    items: [
      { id: 'files-upload', title: '上传文件' },
      { id: 'files-folder', title: '文件夹管理' },
      { id: 'files-operate', title: '文档操作' },
      { id: 'files-view', title: '视图、排序与筛选' },
      { id: 'files-search', title: '搜索与书签' },
      { id: 'files-shortcut', title: '右键菜单与快捷键' },
      { id: 'files-preview', title: '查看与预览' },
    ],
  },
  {
    id: 'pages',
    title: '3. 在线文档',
    items: [
      { id: 'pages-create', title: '创建与编辑' },
      { id: 'pages-cowork', title: '实时协作' },
      { id: 'pages-panel', title: '协作控制面板' },
      { id: 'pages-history', title: '版本历史与对比' },
      { id: 'pages-ann', title: '评论与片段批注' },
      { id: 'pages-sub', title: '订阅更新通知' },
    ],
  },
  {
    id: 'share',
    title: '4. 分享',
    items: [
      { id: 'share-gen', title: '生成分享链接' },
      { id: 'share-page', title: '分享落地页' },
      { id: 'share-copy', title: '复制文档链接' },
    ],
  },
  {
    id: 'account',
    title: '5. 账号与邮箱',
    items: [
      { id: 'acc-email', title: '邮箱绑定与验证' },
      { id: 'acc-profile', title: '个人主页' },
    ],
  },
  {
    id: 'admin',
    title: '6. 管理后台',
    items: [
      { id: 'admin-overview', title: '概览与文档管理' },
      { id: 'admin-users', title: '用户与权限' },
      { id: 'admin-logs', title: '日志与备份' },
    ],
  },
  {
    id: 'custom',
    title: '7. 个性化设置',
    items: [
      { id: 'custom-theme', title: '主题切换' },
      { id: 'custom-lang', title: '中英文切换' },
    ],
  },
  {
    id: 'desktop',
    title: '8. 桌面版（Electron）',
    items: [
      { id: 'desktop-download', title: '下载与自动更新' },
      { id: 'desktop-tts', title: 'TTS 朗读' },
      { id: 'desktop-window', title: '多窗口与托盘' },
    ],
  },
  {
    id: 'faq',
    title: '9. 快捷键与常见问题',
    items: [
      { id: 'faq-keys', title: '快捷键一览' },
      { id: 'faq-common', title: '常见问题' },
    ],
  },
]

// 滚动到指定小节（h3 锚点）
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 使用说明页（2.6.6）：左侧可展开/折叠目录 + 完整功能使用说明
export default function UsageGuide() {
  // 章节折叠状态：默认全部展开
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true])),
  )

  return (
    <div className="guide-page">
      <aside className="guide-sidebar">
        <div className="guide-toc-title">使用说明</div>
        {SECTIONS.map((s) => (
          <div key={s.id} className="guide-toc-group">
            <button
              className="guide-toc-chapter"
              onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
            >
              <svg
                className={`guide-chevron ${open[s.id] ? 'guide-chevron--open' : ''}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {s.title}
            </button>
            {open[s.id] && (
              <ul className="guide-toc-items">
                {s.items.map((item) => (
                  <li key={item.id}>
                    <button className="guide-toc-item" onClick={() => scrollTo(item.id)}>
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </aside>

      <main className="guide-content">
        <h1>北牖 NorthBooker 使用说明</h1>

        {/* ============ 1. 快速开始 ============ */}
        <section id="quickstart" className="guide-section">
          <h2>1. 快速开始</h2>
          <h3 id="qs-what">什么是北牖</h3>
          <p>
            北牖（NorthBooker）是一个基于云端的文档管理与协作平台，提供文件托管、在线预览、实时协作编辑、分享与订阅通知等能力。支持
            PDF、Word、Excel、PPT、图片、Markdown、纯文本等多种格式的在线预览，也可创建多人实时同步的在线文档。
          </p>
          <h3 id="qs-login">账号登录</h3>
          <p>点击右上角「登录」按钮，通过玄剑账号（www.xuanjian.top）授权即可登录，无需单独注册。</p>
          <ul>
            <li>登录后可上传文件、创建在线文档、参与协作、管理自己的内容</li>
            <li>未登录只能浏览公开的文档与文件</li>
            <li>登录状态保存在浏览器本地，刷新页面不会丢失</li>
          </ul>
          <h3 id="qs-platform">网页版与桌面版</h3>
          <p>北牖提供两种使用方式：</p>
          <ul>
            <li><strong>网页版</strong>：访问 northbooker.xuanjian.top，无需安装，适合轻量使用</li>
            <li><strong>桌面版</strong>：在网页版下载 Windows 安装包，支持 TTS 朗读、多窗口、托盘、自动更新等增强能力，数据与网页版完全同步</li>
          </ul>
        </section>

        {/* ============ 2. 文件托管 ============ */}
        <section id="files" className="guide-section">
          <h2>2. 文件托管</h2>
          <h3 id="files-upload">上传文件</h3>
          <p>点击工具栏「上传」按钮，或右键空白处选择「上传文档」，即可打开上传对话框：</p>
          <ul>
            <li>支持一次选择或拖拽<strong>多个文件</strong>批量上传，可逐个移除，显示总进度</li>
            <li>支持 PDF / Word / Excel / PPT / 图片 / 文本 / Markdown 等格式，单个文件最大 100MB</li>
            <li>上传到某个文件夹内时，文件自动归入该文件夹</li>
            <li>上传成功后文件对所有公开访问者可见，也可在管理后台设为私有</li>
          </ul>
          <h3 id="files-folder">文件夹管理</h3>
          <ul>
            <li>点击「新建文件夹」或右键空白处可创建文件夹</li>
            <li>双击文件夹进入；拖动文档到文件夹上可移动；右键文件夹可删除</li>
            <li>顶部路径条可随时返回上级或根目录</li>
            <li>进入文件夹打开文档后返回，会保持所在文件夹，不会跳回主页面</li>
          </ul>
          <h3 id="files-operate">文档操作</h3>
          <ul>
            <li><strong>打开</strong>：点击文档卡片进入预览页</li>
            <li><strong>更名</strong>：右键文档选择「更名」，或管理后台重命名</li>
            <li><strong>分享</strong>：右键文档选择「分享」，生成带密码 / 有效期选项的分享链接</li>
            <li><strong>标签</strong>：右键文档「编辑标签」，用逗号分隔最多 10 个；列表页可按标签筛选</li>
            <li><strong>删除</strong>：右键「删除」移入回收站，可在回收站恢复或永久删除</li>
            <li><strong>书签</strong>：卡片右上角星标收藏，可在「书签」筛选下查看</li>
          </ul>
          <h3 id="files-view">视图、排序与筛选</h3>
          <ul>
            <li><strong>网格 / 列表</strong>：右上角切换视图模式</li>
            <li><strong>排序</strong>：按更新时间或标题排序</li>
            <li><strong>类型筛选</strong>：全部 / 书签 / PDF / Word / Excel / PPT / 图片 / Markdown / 文本</li>
            <li><strong>最近</strong>：只看最近 7 天更新的文档</li>
          </ul>
          <h3 id="files-search">搜索与书签</h3>
          <p>顶部「全文搜索」可搜索文档内容，结果按文档 / 在线文档分类，点击直接跳转。收藏过的文档会出现在书签筛选下。</p>
          <h3 id="files-shortcut">右键菜单与快捷键</h3>
          <p>文档支持右键菜单快捷操作；列表模式下可用键盘导航（方向键移动、Enter 打开、Delete 删除、Backspace 返回上级）。</p>
          <h3 id="files-preview">查看与预览</h3>
          <p>预览页支持文档缩放、全屏、下载、复制链接、分享与评论。Office 文档（PPT / Excel / CSV）在浏览器内直接渲染，无需下载。</p>
        </section>

        {/* ============ 3. 在线文档 ============ */}
        <section id="pages" className="guide-section">
          <h2>3. 在线文档</h2>
          <h3 id="pages-create">创建与编辑</h3>
          <p>进入「在线文档」页面，点击「创建文档」即可新建。编辑器支持标题、加粗、列表、引用、代码块等富文本能力，以及 Markdown 分屏编辑。</p>
          <ul>
            <li>内容自动保存，也可按 Ctrl+S 手动保存</li>
            <li>底部栏可切换公开 / 私有可见性</li>
            <li>创建后显示作者信息，点击作者可进入其个人主页</li>
          </ul>
          <h3 id="pages-cowork">实时协作</h3>
          <p>基于 Yjs 的多人实时同步：公开文档的登录用户可同时编辑，修改实时出现在他人屏幕。</p>
          <ul>
            <li><strong>任何人可编辑（open）</strong>：默认策略，所有登录用户均可编辑</li>
            <li><strong>仅作者可编辑（author）</strong>：只有作者能编辑，其他人只读</li>
            <li>私有文档仅作者本人可编辑</li>
            <li>协作与自动保存均经过权限校验，无权者无法写入内容</li>
          </ul>
          <h3 id="pages-panel">协作控制面板</h3>
          <p>在编辑器底部栏点击权限按钮，进入 <code>/pages/:id/cowork_set</code> 协作控制面板，可集中管理：</p>
          <ul>
            <li>协作编辑权限（open / author）</li>
            <li>可见性切换（公开 / 私有）</li>
            <li>订阅更新通知开关</li>
            <li>查看文档信息（作者 / 更新时间）</li>
          </ul>
          <h3 id="pages-history">版本历史与对比</h3>
          <p>每次保存自动生成版本快照（最多保留 5 条）。底部栏「版本历史」可查看、对比版本差异：</p>
          <ul>
            <li>对比相对上一版本的修改，新增（绿）与修改（黄）在正文中高亮</li>
            <li>被删去的内容以红色删除线标注，方便找回</li>
            <li>可一键回滚到指定版本</li>
          </ul>
          <h3 id="pages-ann">评论与片段批注</h3>
          <ul>
            <li><strong>评论</strong>：预览页 / 编辑页底部评论区可对文档发表评论</li>
            <li><strong>片段批注</strong>：选中正文文本可添加批注，正文黄色高亮；批注面板支持跳转与删除</li>
          </ul>
          <h3 id="pages-sub">订阅更新通知</h3>
          <p>订阅在线文档后，文档更新会向你的绑定邮箱发送通知邮件（需先完成邮箱绑定）。可在协作控制面板或编辑器底部栏管理订阅。</p>
        </section>

        {/* ============ 4. 分享 ============ */}
        <section id="share" className="guide-section">
          <h2>4. 分享</h2>
          <h3 id="share-gen">生成分享链接</h3>
          <p>文件与在线文档均可生成分享链接，支持设置访问密码与有效期（1 小时 / 1 天 / 7 天 / 永久）。</p>
          <ul>
            <li>分享链接形如 <code>https://northbooker.xuanjian.top/share/xxxxxxxx</code></li>
            <li>设置了密码的链接，访问时需要输入分享者提供的密码</li>
            <li>分享链接为绝对地址，在任何设备 / 应用上均可直接打开</li>
          </ul>
          <h3 id="share-page">分享落地页</h3>
          <p>打开分享链接进入独立分享页：托管文件直接在线预览，在线文档渲染完整正文；设有密码时先显示密码验证。分享页无需登录即可查看。</p>
          <h3 id="share-copy">复制文档链接</h3>
          <p>预览页 / 编辑器的「复制链接」会复制该文档的线上地址（如 <code>/viewer/xxx</code>、<code>/pages/xxx</code>），方便发给他人或收藏。</p>
        </section>

        {/* ============ 5. 账号与邮箱 ============ */}
        <section id="account" className="guide-section">
          <h2>5. 账号与邮箱</h2>
          <h3 id="acc-email">邮箱绑定与验证</h3>
          <ul>
            <li>未绑定邮箱登录后会自动弹出绑定提示，输入邮箱后系统发送验证邮件</li>
            <li>点击邮件中的验证链接即完成绑定，页面自动刷新</li>
            <li>邮箱用于接收订阅文档的更新通知；点击「稍后再说」本次会话不再提示</li>
          </ul>
          <h3 id="acc-profile">个人主页</h3>
          <p>点击头像菜单中的「个人主页」进入 <code>/profile/:user</code>，公开可看，展示：</p>
          <ul>
            <li>贡献总字数、创作文档数、上传文件数、订阅文档数</li>
            <li>邮箱绑定状态、等级与加入时间</li>
            <li>订阅的文档列表（仅本人或管理员可见详情）</li>
            <li>页面中所有作者 / 上传者信息均可点击跳转到其个人主页</li>
          </ul>
        </section>

        {/* ============ 6. 管理后台 ============ */}
        <section id="admin" className="guide-section">
          <h2>6. 管理后台</h2>
          <p>等级 ≥ 1 的用户（管理员）可在头像菜单进入管理后台。</p>
          <h3 id="admin-overview">概览与文档管理</h3>
          <ul>
            <li>统计概览：文档总数、用户数、管理员数、存储总量</li>
            <li>文档管理：重命名、切换可见性、删除；表格展示上传者并可跳转其主页</li>
            <li>回收站：恢复或永久删除（同步清理对象存储）</li>
          </ul>
          <h3 id="admin-users">用户与权限</h3>
          <p>用户列表展示玄剑 ID、等级、贡献与注册时间，点击用户名可进入其个人主页。</p>
          <h3 id="admin-logs">日志与备份</h3>
          <ul>
            <li>审计日志：记录删除、上传、更新等管理操作</li>
            <li>登录日志：记录登录时间、IP、UA 与结果</li>
            <li>备份：下载 SQLite 完整快照或全量 JSON 导出，用于迁移与归档</li>
          </ul>
        </section>

        {/* ============ 7. 个性化设置 ============ */}
        <section id="custom" className="guide-section">
          <h2>7. 个性化设置</h2>
          <h3 id="custom-theme">主题切换</h3>
          <p>导航栏主题按钮支持三态切换：跟随系统 / 亮色 / 暗色。暗色主题下文档预览与编辑器同样适配。</p>
          <h3 id="custom-lang">中英文切换</h3>
          <p>导航栏语言按钮一键切换中文 / 英文界面，关键页面文案均已国际化。</p>
        </section>

        {/* ============ 8. 桌面版 ============ */}
        <section id="desktop" className="guide-section">
          <h2>8. 桌面版（Electron）</h2>
          <h3 id="desktop-download">下载与自动更新</h3>
          <p>网页版「应用下载」页可下载 Windows 安装包。桌面版启动后自动检查更新，发现新版本时右下角弹出通知卡片，下载完成后一键安装。更新源为 GitHub Releases + 七牛 CDN 双源。</p>
          <h3 id="desktop-tts">TTS 朗读</h3>
          <p>编辑器底部栏的朗读按钮可将正文分句朗读（本地语音合成），支持进度显示与暂停 / 继续。</p>
          <h3 id="desktop-window">多窗口与托盘</h3>
          <ul>
            <li>支持新建辅助窗口，同时打开多个文档</li>
            <li>托盘菜单提供新建窗口、打开网页版、关于等快捷入口</li>
            <li>窗口大小与位置自动记忆</li>
          </ul>
        </section>

        {/* ============ 9. 快捷键与常见问题 ============ */}
        <section id="faq" className="guide-section">
          <h2>9. 快捷键与常见问题</h2>
          <h3 id="faq-keys">快捷键一览</h3>
          <table className="guide-table">
            <thead>
              <tr><th>快捷键</th><th>功能</th></tr>
            </thead>
            <tbody>
              <tr><td><code>Ctrl+S</code></td><td>保存当前在线文档</td></tr>
              <tr><td><code>Ctrl+/</code></td><td>打开快捷键帮助面板</td></tr>
              <tr><td><code>↑ ↓ Enter</code></td><td>文件列表键盘导航（打开）</td></tr>
              <tr><td><code>Delete</code></td><td>删除选中的文档（列表模式）</td></tr>
              <tr><td><code>Backspace</code></td><td>返回上级文件夹</td></tr>
            </tbody>
          </table>
          <h3 id="faq-common">常见问题</h3>
          <ul>
            <li><strong>文档内容被清空？</strong> 系统内置空内容覆盖保护：文档已有内容时拒绝被空内容覆盖，请放心使用</li>
            <li><strong>为什么打开的是只读？</strong> 私有文档仅作者可编辑；公开文档在「仅作者」策略下访客只读</li>
            <li><strong>分享链接打不开？</strong> 请确认链接完整（以 https://northbooker.xuanjian.top/share/ 开头），且未过期；设置了密码需输入密码</li>
            <li><strong>收不到订阅通知邮件？</strong> 请先完成邮箱绑定与验证，并确认已订阅该文档</li>
            <li><strong>上传失败？</strong> 单个文件需 ≤ 100MB；请确认网络连接正常</li>
          </ul>
        </section>

        <footer className="guide-footer">
          <Link to="/">返回首页</Link>
        </footer>
      </main>
    </div>
  )
}
