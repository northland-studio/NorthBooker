// 北牖主题：日间白 + #004AAD，夜间 #1A1B1D + #004AAD（与桌面/网页版一致）
export const Colors = {
  primary: '#004AAD',
  primaryDark: '#002E6E',
  primaryLight: '#E8F0FB',
  bgLight: '#FFFFFF',
  bgDark: '#1A1B1D',
  cardLight: '#F5F7FA',
  cardDark: '#242528',
  textLight: '#1A1B1D',
  textDark: '#F2F3F5',
  subTextLight: '#6B7280',
  subTextDark: '#9CA3AF',
  borderLight: '#E5E7EB',
  borderDark: '#33353A',
  danger: '#DC2626',
  success: '#16A34A',
  warn: '#F59E0B',
}

export type ThemeMode = 'light' | 'dark'

export const getColors = (mode: ThemeMode) => ({
  primary: Colors.primary,
  background: mode === 'dark' ? Colors.bgDark : Colors.bgLight,
  card: mode === 'dark' ? Colors.cardDark : Colors.cardLight,
  text: mode === 'dark' ? Colors.textDark : Colors.textLight,
  subText: mode === 'dark' ? Colors.subTextDark : Colors.subTextLight,
  border: mode === 'dark' ? Colors.borderDark : Colors.borderLight,
  danger: Colors.danger,
  success: Colors.success,
  warn: Colors.warn,
})
