import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 修正 @doc-preview/core 发布产物中 worker 以 .ts 路径引用（实际发布为 .js）
function docPreviewWorkerFix(): Plugin {
  return {
    name: 'doc-preview-worker-fix',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.includes('workers/diff-worker.ts')) return null
      // 相对路径：基于 importer 解析
      if (source.startsWith('.')) {
        const base = importer ? path.dirname(importer) : __dirname
        return path.resolve(base, source).replace(/\.ts$/, '.js')
      }
      // 绝对路径：直接替换扩展名
      return source.replace(/\.ts$/, '.js')
    },
  }
}

// 阻止 Cloudflare Rocket Loader 篡改 script/link 标签
function cloudflareFix(): Plugin {
  return {
    name: 'cloudflare-rocket-loader-fix',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script /g, '<script data-cfasync="false" ')
        .replace(/<link /g, '<link data-cfasync="false" ')
    },
  }
}

// 北牖 NorthBooker 构建配置
export default defineConfig({
  plugins: [react(), docPreviewWorkerFix(), cloudflareFix()],
  // 资源使用绝对路径，保证 /share/:token 等子路径直链下资源可正确加载
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3090',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
})
