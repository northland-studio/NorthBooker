// 后端文件类型推断（与前端 src/utils/fileType.ts 保持一致）

export function getFileType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['docx', 'doc', 'docm', 'dotx'].includes(ext)) return 'docx'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff'].includes(ext)) return 'image'
  if (['txt', 'log', 'csv', 'tsv', 'json', 'xml'].includes(ext)) return 'text'
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  return 'other'
}
