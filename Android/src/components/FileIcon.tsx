// 文件类型图标（SVG 绘制，日间/夜间主题一致使用主色）
import React from 'react'
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg'

const TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  xls: 'XLS',
  xlsx: 'XLSX',
  ppt: 'PPT',
  pptx: 'PPTX',
  csv: 'CSV',
  txt: 'TXT',
  md: 'MD',
  image: 'IMG',
  audio: 'AUD',
  video: 'VID',
}

export default function FileIcon({ type, color, size = 40 }: { type: string; color: string; size?: number }) {
  const label = TYPE_LABEL[type] || 'FILE'
  const fontScale = size / 40
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x="3" y="2" width="34" height="36" rx="5" fill={color} opacity="0.12" />
      <Path
        d="M12 8 H24 L30 14 V32 H12 Z"
        fill="#FFFFFF"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path d="M24 8 V14 H30" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <SvgText
        x="21"
        y="26"
        fontSize={9 * fontScale}
        fontWeight="700"
        fill={color}
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </Svg>
  )
}
