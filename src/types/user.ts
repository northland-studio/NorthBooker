// 用户与权限类型定义

// 权限等级（沿用玄剑官网体系）
// 0 = 普通用户 / 1 = 管理员 / 2 = 超级管理员 / 3 = 最高级
export type UserLevel = 0 | 1 | 2 | 3

export interface User {
  id: number // 本地 users.id
  xuanjianId: number // 玄剑官网用户 id
  username: string
  avatar: string | null
  level: UserLevel
  contribution: number
  title: string | null
}

// 判断是否为管理员（level >= 1）
export function isAdmin(user: User | null | undefined): boolean {
  return !!user && user.level >= 1
}

// 判断是否为超级管理员（level >= 2）
export function isSuperAdmin(user: User | null | undefined): boolean {
  return !!user && user.level >= 2
}
