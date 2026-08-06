// 站点对外根地址：Web 与 Electron 应用统一使用线上域名生成可分享的对外链接
// （Electron 本地加载地址 / 本地服务器地址不可对外使用）
export const SITE_ORIGIN = 'https://northbooker.xuanjian.top'

export function siteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
