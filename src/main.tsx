import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerBuiltinPreviewRenderers } from '@doc-preview/core'
import App from './App'
import '@doc-preview/themes/doc-preview.css'
import './styles/index.css'

// 注册内置文档渲染器（PDF/图片/Word/文本/Markdown/HTML 等）
registerBuiltinPreviewRenderers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
