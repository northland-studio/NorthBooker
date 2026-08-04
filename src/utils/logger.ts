// 北牖前端日志工具
// 开发环境下输出到 console，可扩展为远程上报

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[(import.meta.env.VITE_LOG_LEVEL as LogLevel) || (import.meta.env.DEV ? 'debug' : 'error')]

function formatTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function output(level: LogLevel, module: string, message: string, data?: unknown) {
  if (LEVELS[level] < currentLevel) return

  const prefix = `[${formatTime()}] [${level.toUpperCase()}] [${module}]`
  const line = data !== undefined ? `${prefix} ${message}` : `${prefix} ${message}`

  switch (level) {
    case 'error':
      console.error(line, data ?? '')
      break
    case 'warn':
      console.warn(line, data ?? '')
      break
    default:
      console.log(line, data ?? '')
  }

  // 关键错误可上报到后端（异步，不阻塞）
  if (level === 'error' && import.meta.env.PROD) {
    try {
      const token = localStorage.getItem('nb_token')
      navigator.sendBeacon?.('/api/log', JSON.stringify({
        level,
        module,
        message,
        data,
        ua: navigator.userAgent.slice(0, 200),
        url: window.location.href,
        timestamp: new Date().toISOString(),
        token: token?.slice(0, 10) || null,
      }))
    } catch { /* 静默忽略 */ }
  }
}

const logger = {
  debug: (mod: string, msg: string, data?: unknown) => output('debug', mod, msg, data),
  info: (mod: string, msg: string, data?: unknown) => output('info', mod, msg, data),
  warn: (mod: string, msg: string, data?: unknown) => output('warn', mod, msg, data),
  error: (mod: string, msg: string, data?: unknown) => output('error', mod, msg, data),
}

export default logger
