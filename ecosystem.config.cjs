// 北牖 PM2 进程配置
module.exports = {
  apps: [
    {
      name: 'northbooker',
      script: 'src/index.js',
      cwd: '/var/www/northbooker/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3090,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      error_file: '/var/www/northbooker/server/logs/error.log',
      out_file: '/var/www/northbooker/server/logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
