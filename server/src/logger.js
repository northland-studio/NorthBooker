import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.resolve(__dirname, '../logs')
const LOG_FILE = path.join(LOG_DIR, 'northbooker.log')

// 确保日志目录存在
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'debug'] ?? LEVELS.debug

function formatTime() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function write(level, module, message, data) {
  if (LEVELS[level] < currentLevel) return
  const line = `[${formatTime()}] [${level.toUpperCase()}] [${module}] ${message}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`
  console.log(line)
  try {
    fs.appendFileSync(LOG_FILE, line + '\n')
  } catch {}
}

export default {
  debug: (mod, msg, data) => write('debug', mod, msg, data),
  info: (mod, msg, data) => write('info', mod, msg, data),
  warn: (mod, msg, data) => write('warn', mod, msg, data),
  error: (mod, msg, data) => write('error', mod, msg, data),
}
