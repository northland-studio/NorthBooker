import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerBuiltinPreviewRenderers, registerPreviewRenderer } from '@doc-preview/core'
import {
  legacyPptRenderer,
  pptxDeckRenderer,
  odpDeckRenderer,
  legacyDocRenderer,
  openDocumentRenderer,
  officeBlobRenderer,
  spreadsheetRenderer,
} from '@doc-preview/office'
import App from './App'
import '@doc-preview/themes/doc-preview.css'
import './styles/index.css'

// 注册内置文档渲染器（PDF/图片/Word/文本/Markdown/HTML 等）
registerBuiltinPreviewRenderers()
// 注册 Office 客户端渲染器（不含云查看器，因为七牛私有空间签名 URL 对外不可访问）
registerPreviewRenderer(legacyPptRenderer)
registerPreviewRenderer(pptxDeckRenderer)
registerPreviewRenderer(odpDeckRenderer)
registerPreviewRenderer(legacyDocRenderer)
registerPreviewRenderer(openDocumentRenderer)
registerPreviewRenderer(officeBlobRenderer)
registerPreviewRenderer(spreadsheetRenderer)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
