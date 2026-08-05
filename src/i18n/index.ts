import { create } from 'zustand'

export type Lang = 'zh' | 'en'

const STORAGE_KEY = 'northbooker-lang'

const zh: Record<string, string> = {
  // 导航
  'nav.onlineDocs': '在线文档',
  'nav.download': '应用下载',
  'nav.terms': '用户协议',
  'nav.settings': '桌面端设置',
  'nav.menu': '菜单',
  // 文档列表
  'doc.all': '全部',
  'doc.bookmarks': '书签',
  'doc.recent': '最近',
  'doc.select': '选择',
  'doc.selectAll': '全选',
  'doc.cancelSelect': '取消选择',
  'doc.upload': '上传',
  'doc.newFolder': '新建文件夹',
  'doc.trash': '回收站',
  'doc.filter': '过滤文档...',
  'doc.search': '全文搜索...',
  'doc.sortRecent': '最近更新',
  'doc.sortTitle': '标题排序',
  'doc.searching': '搜索中...',
  'doc.noResult': '无结果',
  'doc.loading': '加载中...',
  'doc.loadFailed': '数据加载失败，请确认权限后重试',
  'doc.empty': '未找到匹配的内容',
  'doc.trashEmpty': '回收站为空',
  'doc.open': '打开',
  'doc.share': '分享',
  'doc.move': '移动至',
  'doc.editTags': '编辑标签',
  'doc.delete': '删除',
  'doc.folder': '文件夹',
  // 查看页
  'viewer.back': '返回',
  'viewer.forward': '转发',
  'viewer.copied': '已复制',
  'viewer.share': '分享',
  'viewer.comment': '评论',
  'viewer.notFound': '文档不存在',
  'viewer.notFoundDesc': '该文档可能已被删除或不可访问',
  'viewer.backToList': '返回列表',
  // 在线文档编辑器
  'editor.save': '保存',
  'editor.saving': '保存中...',
  'editor.versions': '版本历史',
  'editor.comments': '评论',
  'editor.annotations': '片段批注',
  'editor.subscribe': '订阅更新（更新后邮件通知）',
  'editor.unsubscribe': '取消订阅（更新后邮件通知）',
  'editor.search': '搜索',
  'editor.share': '生成分享链接',
  'editor.copyLink': '复制链接',
  'editor.exitCompare': '退出对比',
  'editor.shortcuts': '键盘快捷键',
  'editor.settings': '设置',
  // 管理后台
  'admin.title': '管理后台',
  'admin.refresh': '刷新',
  'admin.documents': '文档管理',
  'admin.users': '用户管理',
  'admin.trash': '回收站',
  'admin.audit': '审计日志',
  'admin.loginLogs': '登录日志',
  'admin.backup': '数据备份',
  // 设置
  'settings.title': '桌面端设置',
  'settings.theme': '主题',
  'settings.language': '语言',
}

const en: Record<string, string> = {
  'nav.onlineDocs': 'Online Docs',
  'nav.download': 'Download',
  'nav.terms': 'Terms',
  'nav.settings': 'Desktop Settings',
  'nav.menu': 'Menu',
  'doc.all': 'All',
  'doc.bookmarks': 'Bookmarks',
  'doc.recent': 'Recent',
  'doc.select': 'Select',
  'doc.selectAll': 'Select All',
  'doc.cancelSelect': 'Cancel',
  'doc.upload': 'Upload',
  'doc.newFolder': 'New Folder',
  'doc.trash': 'Trash',
  'doc.filter': 'Filter docs...',
  'doc.search': 'Full-text search...',
  'doc.sortRecent': 'Recently updated',
  'doc.sortTitle': 'Sort by title',
  'doc.searching': 'Searching...',
  'doc.noResult': 'No results',
  'doc.loading': 'Loading...',
  'doc.loadFailed': 'Failed to load data, check permissions and retry',
  'doc.empty': 'No matching content',
  'doc.trashEmpty': 'Trash is empty',
  'doc.open': 'Open',
  'doc.share': 'Share',
  'doc.move': 'Move to',
  'doc.editTags': 'Edit tags',
  'doc.delete': 'Delete',
  'doc.folder': 'Folder',
  'viewer.back': 'Back',
  'viewer.forward': 'Forward',
  'viewer.copied': 'Copied',
  'viewer.share': 'Share',
  'viewer.comment': 'Comment',
  'viewer.notFound': 'Document not found',
  'viewer.notFoundDesc': 'The document may have been deleted or is inaccessible',
  'viewer.backToList': 'Back to list',
  'editor.save': 'Save',
  'editor.saving': 'Saving...',
  'editor.versions': 'History',
  'editor.comments': 'Comments',
  'editor.annotations': 'Annotations',
  'editor.subscribe': 'Subscribe to updates',
  'editor.unsubscribe': 'Unsubscribe',
  'editor.search': 'Search',
  'editor.share': 'Share link',
  'editor.copyLink': 'Copy link',
  'editor.exitCompare': 'Exit compare',
  'editor.shortcuts': 'Keyboard Shortcuts',
  'editor.settings': 'Settings',
  'admin.title': 'Admin',
  'admin.refresh': 'Refresh',
  'admin.documents': 'Documents',
  'admin.users': 'Users',
  'admin.trash': 'Trash',
  'admin.audit': 'Audit Logs',
  'admin.loginLogs': 'Login Logs',
  'admin.backup': 'Backup',
  'settings.title': 'Desktop Settings',
  'settings.theme': 'Theme',
  'settings.language': 'Language',
}

const dict: Record<Lang, Record<string, string>> = { zh, en }

interface I18nState {
  lang: Lang
  setLang: (l: Lang) => void
}

function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'zh'
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'en' ? 'en' : 'zh'
}

export const useI18n = create<I18nState>((set) => ({
  lang: getInitialLang(),
  setLang: (l) => {
    localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    set({ lang: l })
  },
}))

// 翻译函数 hook
export function useT() {
  const lang = useI18n((s) => s.lang)
  return (key: string): string => dict[lang][key] ?? key
}
