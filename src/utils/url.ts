// URI 解析工具
// Electron 环境下，相对路径 URI（如 /docs/sample.md）由本地 HTTP 服务器代理到生产服务器

export function resolveUri(uri: string): string {
  if (!uri) return uri
  // 已经是完整 URL（http/https/七牛CDN），直接返回
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  // Electron / Web 都保持相对路径，由各自的服务器处理
  return uri
}
