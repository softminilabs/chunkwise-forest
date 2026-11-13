// 配色取自参考图：奶粉底、紫、荧光绿、黑，所有物件带一圈白色贴纸边
export const C = {
  cream: '#FDF6F6', creamDeep: '#F7ECEC', white: '#FFFFFF', ink: '#191917',
  violet: '#A768FA', violetDeep: '#8448E0', lilac: '#CA99FD', lilacSoft: '#E2C7FC', lilacPale: '#F3E8FF',
  lime: '#CBED19', limeDeep: '#B4D80A', skin: '#FFE4D0', glow: '#FFF6B8',
}

/// 一天里三个时刻的环境色，中间按太阳高度插值
export const SKY = {
  day: { sky: '#FDF6F6', flat: '#FFFFFF', outline: '#FFFFFF', sun: '#FFFFFF', ground: '#EBD9FF' },
  dusk: { sky: '#F7CFE4', flat: '#F6DCEC', outline: '#FFF3F8', sun: '#FFD0B0', ground: '#E3C2F5' },
  night: { sky: '#2B2050', flat: '#8474BD', outline: '#D6C8F7', sun: '#C9BAFF', ground: '#7462B0' },
}
