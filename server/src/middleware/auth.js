// 认证与权限中间件（批次5实现 OAuth 后启用）

// 校验 JWT，注入 req.userId / req.userLevel
export function authMiddleware(req, res, next) {
  // TODO: 批次5实现
  next()
}

// 要求 level >= 1（管理员）
export function adminMiddleware(req, res, next) {
  // TODO: 批次5实现
  next()
}

// 要求 level >= 2（超级管理员）
export function superAdminMiddleware(req, res, next) {
  // TODO: 批次5实现
  next()
}
