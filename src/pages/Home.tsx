import { Link } from 'react-router-dom'

// 北牖首页
export default function Home() {
  return (
    <div className="page-home">
      <img src="/icon.png" alt="北牖" className="page-home-logo" />
      <h1>北牖 NorthBooker</h1>
      <p>云端文档查看网站</p>
      <p className="page-home-sub">由北域工作室开发</p>
      <Link to="/viewer/sample" className="page-home-cta">
        查看示例文档
      </Link>
    </div>
  )
}
