import { useNavigate } from 'react-router-dom'

interface AppItem {
  platform: string
  label: string
  desc: string
  icon: React.ReactNode
  url: string
  version: string
}

// 应用下载页面
export default function PageDownload() {
  const navigate = useNavigate()

  const apps: AppItem[] = [
    {
      platform: 'windows',
      label: 'Windows',
      desc: '适用于 Windows 10 及以上系统',
      version: 'v1.0.1',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4l8-1v9H2zM21 4l-8-1v9h8zM2 20l8-1v-8H2zM21 20l-8-1v-8h8z" />
        </svg>
      ),
      url: 'https://github.com/northland-studio/NorthBooker/releases/latest',
    },
    {
      platform: 'macos',
      label: 'macOS',
      desc: '适用于 macOS 11 及以上系统（Intel / Apple Silicon）',
      version: 'v1.0.1',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2C8.5 2 5 4 5 8.5 5 11 6.5 13 9 14l-1 4h8l-1-4c2.5-1 4-3 4-5.5C19 4 15.5 2 12 2z" />
          <path d="M12 2c-.5 0-1 .5-1.5 1.5 0 .5.5 1 1 1 .5 0 1-.5 1-1 0-1-.5-1.5-.5-1.5z" />
        </svg>
      ),
      url: 'https://github.com/northland-studio/NorthBooker/releases/latest',
    },
    {
      platform: 'linux',
      label: 'Linux',
      desc: 'AppImage / deb 格式，适用于主流 Linux 发行版',
      version: 'v1.0.1',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a6 6 0 0 0-6 6v2a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6z" />
          <circle cx="9" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
          <path d="M7 11c1 2 3 3 5 3s4-1 5-3" />
        </svg>
      ),
      url: 'https://github.com/northland-studio/NorthBooker/releases/latest',
    },
  ]

  return (
    <div className="static-page">
      <button className="viewer-back" onClick={() => navigate(-1)} aria-label="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        返回
      </button>

      <article className="static-page-content">
        <h1>应用下载</h1>
        <p className="static-page-date">选择你的平台，下载北牖桌面客户端</p>

        <div className="download-grid">
          {apps.map((app) => (
            <a
              key={app.platform}
              className="download-card"
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="download-card-icon">{app.icon}</div>
              <div className="download-card-info">
                <div className="download-card-header">
                  <span className="download-card-label">{app.label}</span>
                  <span className="download-card-version">{app.version}</span>
                </div>
                <p className="download-card-desc">{app.desc}</p>
              </div>
              <div className="download-card-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        <p className="static-page-footer-note">
          桌面版目前通过 GitHub Releases 分发。自动更新功能已内置，安装后会自动获取最新版本。
        </p>
      </article>
    </div>
  )
}
