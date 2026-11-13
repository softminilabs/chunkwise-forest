// 配色取自一张贴纸风的参考图：奶粉底、紫、荧光绿、黑，物件带一圈白色贴纸边。
// 比参考图收了一点：面积最大的地面和天空压低了亮度，整屏太亮看久了累眼
export const C = {
  cream: '#F8F1F3', creamDeep: '#F1E7EA', white: '#FFFFFF', ink: '#1E1B26',
  violet: '#A26AF5', violetDeep: '#8048DA', lilac: '#C59BF8', lilacSoft: '#DCC6F6', lilacPale: '#F0E6FB',
  lime: '#C8EA1E', limeDeep: '#B2D50C', skin: '#FFE4D0', glow: '#FFF6B8',
  leaf: '#C4E332', patch: '#D0B5F4', pane: '#D9C6FF', bulbOff: '#C9B2EE', bulbTwo: '#FFF27A', shade: '#4A2C8F',
}

/// 一天里三个时刻的环境色，中间按太阳高度插值。flat 是给地面这类不受光照的纯色整体染的色
export const SKY = {
  day: { sky: '#F4EDF2', flat: '#F6F1F8', outline: '#FFFFFF', sun: '#FFFFFF', ground: '#EBD9FF' },
  dusk: { sky: '#F3CEE1', flat: '#F3DAEA', outline: '#FFF3F8', sun: '#FFD0B0', ground: '#E3C2F5' },
  night: { sky: '#2B2050', flat: '#8474BD', outline: '#D6C8F7', sun: '#C9BAFF', ground: '#7462B0' },
}
