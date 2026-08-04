import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// SVG 图标集
const Icons = {
  windows: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4l8-1v9H2zM21 4l-8-1v9h8zM2 20l8-1v-8H2zM21 20l-8-1v-8h8z" />
    </svg>
  ),
  ios: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  android: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="3" width="14" height="16" rx="3" />
      <line x1="9" y1="7" x2="9" y2="7.01" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="7" x2="15" y2="7.01" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 21l1-2h4l1 2" />
      <line x1="12" y1="19" x2="12" y2="19.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

// 应用下载页面
export default function PageDownload() {
  const navigate = useNavigate()
  const [version, setVersion] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('https://api.github.com/repos/northland-studio/NorthBooker/releases/latest')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        setVersion((data.tag_name || '').replace(/^v/, ''))
        setLoading(false)
      })
      .catch(() => {
        setError('无法获取最新版本信息，请稍后重试')
        setLoading(false)
      })
  }, [])

  const v = version || '...'

  const cdnUrl = (filename: string) => `/api/download/releases/${filename}`

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
        <p className="static-page-date">
          {loading ? '正在获取最新版本...' : error ? error : `最新版本 v${v}`}
        </p>

        {/* Windows 桌面端下载 */}
        <div className="download-grid">
          <div className="download-card download-card--dual">
            <div className="download-card-icon">{Icons.windows}</div>
            <div className="download-card-info">
              <div className="download-card-header">
                <span className="download-card-label">Windows</span>
                <span className="download-card-version">v{v}</span>
              </div>
              <p className="download-card-desc">适用于 Windows 10 及以上系统</p>
              <div className="download-card-sources">
                <a
                  className="download-source-btn download-source-btn--github"
                  href={`https://github.com/northland-studio/NorthBooker/releases/tag/v${v}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </a>
                {version && (
                  <a
                    className="download-source-btn download-source-btn--cdn"
                    href={cdnUrl(`northbooker-desktop-setup-${version}.exe`)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    CDN 下载
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* iOS PWA 安装 */}
        <h2 style={{ marginTop: 32 }}>iOS</h2>
        <div className="download-card download-card--pwa">
          <div className="download-card-icon">{Icons.ios}</div>
          <div className="download-card-info">
            <div className="download-card-header">
              <span className="download-card-label">iOS / iPadOS</span>
              <span className="download-card-version">PWA</span>
            </div>
            <p className="download-card-desc">
              无需下载，通过 Safari 添加到主屏幕即可像原生应用一样使用
            </p>
            <div className="download-pwa-steps">
              <div className="download-pwa-step">
                <span className="download-pwa-step-num">1</span>
                <span>在 Safari 中打开本网站</span>
              </div>
              <div className="download-pwa-step">
                <span className="download-pwa-step-num">2</span>
                <span>点击底部 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'middle'}}><path d="M12 5v14M5 12h14" /></svg> 分享按钮</span>
              </div>
              <div className="download-pwa-step">
                <span className="download-pwa-step-num">3</span>
                <span>选择「添加到主屏幕」</span>
              </div>
            </div>
          </div>
        </div>

        {/* Android 预留 */}
        <h2 style={{ marginTop: 32 }}>Android</h2>
        <div className="download-card download-card--pending">
          <div className="download-card-icon">{Icons.android}</div>
          <div className="download-card-info">
            <div className="download-card-header">
              <span className="download-card-label">Android</span>
              <span className="download-card-version" style={{ background: 'rgba(156,163,175,.15)', color: 'var(--color-text-muted)' }}>
                即将推出
              </span>
            </div>
            <p className="download-card-desc">
              Android 版正在开发中，敬请期待。届时将提供 APK 直接下载和应用商店分发。
            </p>
          </div>
        </div>

        <p className="static-page-footer-note">
          桌面版内置自动更新功能，安装后会自动获取最新版本。CDN 下载链路经七牛私有签名认证。
        </p>
      </article>
    </div>
  )
}
