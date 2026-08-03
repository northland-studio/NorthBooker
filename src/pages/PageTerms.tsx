import { useNavigate } from 'react-router-dom'

// 用户协议页面
export default function PageTerms() {
  const navigate = useNavigate()

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
        <h1>用户协议</h1>
        <p className="static-page-date">最后更新日期：2026 年 8 月 4 日</p>

        <section>
          <h2>1. 服务说明</h2>
          <p>
            北牖 NorthBooker（以下简称"本服务"）是由北域工作室提供的云端文档查看与在线协作平台。
            用户可通过本服务上传、查看、分享文档，以及创建在线协作文档。
          </p>
        </section>

        <section>
          <h2>2. 账号与认证</h2>
          <p>
            本服务通过玄剑官网（www.xuanjian.top）提供 OAuth 单点登录。
            用户在玄剑官网注册并授权后，即可使用本服务的全部功能。
            用户应妥善保管自己的玄剑账号，因账号泄露导致的问题由用户自行承担。
          </p>
        </section>

        <section>
          <h2>3. 用户行为规范</h2>
          <p>用户在使用本服务时，不得从事以下行为：</p>
          <ul>
            <li>上传或分享含有违法、侵权、淫秽、暴力等内容的文档</li>
            <li>干扰或破坏本服务的正常运行</li>
            <li>利用本服务进行任何商业广告或垃圾信息传播</li>
            <li>未经授权访问他人文档或账号</li>
          </ul>
        </section>

        <section>
          <h2>4. 知识产权</h2>
          <p>
            用户上传的文档内容，其知识产权仍归用户所有。
            本服务不会对用户文档内容主张任何权利。
            本服务自身的代码、界面设计、品牌标识等知识产权归北域工作室所有。
          </p>
        </section>

        <section>
          <h2>5. 免责声明</h2>
          <p>
            本服务按"现状"提供，不作出任何明示或默示的保证。
            北域工作室不对因使用本服务而产生的任何直接或间接损失承担责任。
            本服务保留随时修改或中断服务的权利。
          </p>
        </section>

        <section>
          <h2>6. 协议修改</h2>
          <p>
            北域工作室有权随时修改本协议条款。修改后的协议将在本页面公布，继续使用本服务即视为同意修改后的协议。
          </p>
        </section>

        <section>
          <h2>7. 联系方式</h2>
          <p>
            如对本协议有任何疑问，请联系：
            <a href="mailto:morzane_work@foxmail.com">morzane_work@foxmail.com</a>
          </p>
        </section>
      </article>
    </div>
  )
}
