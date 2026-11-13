// 森林长什么样，全由季节定：天（上、下两个色）、地面两个色、松树、阔叶树的几种色、小路、日光、溪水。
// 夜里只换天色和光，东西本身的颜色不变，靠光照暗下去
import * as THREE from 'three'

export const SEASONS = ['spring', 'summer', 'autumn', 'winter']
export const SEASON_NAMES = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
export const LOOK = {
  spring: { sky: ['#BFE1EE', '#EDF6EA'], ground: ['#A5D38C', '#B9DE9C'], pine: '#62A678', leaf: ['#BFE39B', '#F5BBCD', '#FAD7E2', '#A6D788'], path: '#E6D6B2', sun: '#FFF3DC', water: '#A9D5DE' },
  summer: { sky: ['#A3D5EC', '#E0F2E2'], ground: ['#74B868', '#8AC873'], pine: '#2F7554', leaf: ['#4FA058', '#6FBA63', '#3F8E56'], path: '#DDC99C', sun: '#FFFFFF', water: '#97CCD8' },
  autumn: { sky: ['#EFD3AE', '#F9EDDA'], ground: ['#AEB068', '#BFB267'], pine: '#4F7254', leaf: ['#E68B3B', '#D9573B', '#F2BE48', '#C96C2F'], path: '#E3CFA2', sun: '#FFE0B4', water: '#A6C9CD' },
  winter: { sky: ['#C6DAE9', '#EFF5F8'], ground: ['#F3F7F9', '#E4EDF2'], pine: '#3F685A', leaf: ['#E8F0F4'], path: '#DDE6EB', sun: '#F3F7FF', water: '#D5E8F0' },
}
export const NIGHT_SKY = { spring: ['#0E1F30', '#213E4A'], summer: ['#0B1D2C', '#1B3D42'], autumn: ['#121A2E', '#2B3147'], winter: ['#111A2D', '#2B394F'] }

/// 这个季节、这个时候能有哪些天气：春夏秋下雨、冬天下雪，流星只在夜里。春天不会下雪
export const weathersOf = (season, night) => ['clear', season === 'winter' ? 'snow' : 'rain', ...(night ? ['meteor'] : [])]
export const WEATHER_NAMES = { clear: '晴', snow: '下雪', meteor: '流星', rain: { spring: '小雨', summer: '雷雨', autumn: '秋雨' } }

/// 今天算哪个季节：三到五月春，六到八月夏，九到十一月秋，其余冬
export const seasonOf = (date = new Date()) => SEASONS[Math.floor(((date.getMonth() + 10) % 12) / 3)]

export const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, metalness: 0, ...options })
export const at = (object, x, y, z) => { object.position.set(x, y, z); return object }
export const shade = mesh => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
export const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt))

/// 固定种子的随机数：每次打开，树和石头都在老地方
export function seeded(seed) {
  let state = seed
  const next = () => { state |= 0; state = state + 0x6D2B79F5 | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  return { next, between: (a, b) => a + (b - a) * next(), pick: list => list[Math.floor(next() * list.length)] }
}

/// 一个软边的圆点，飘的东西（雪、花瓣、萤火虫、火星）都用它
export const dot = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')
  const fill = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  fill.addColorStop(0, 'rgba(255,255,255,1)')
  fill.addColorStop(0.55, 'rgba(255,255,255,.9)')
  fill.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = fill
  context.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
})()
export const points = options => new THREE.PointsMaterial({ map: dot, transparent: true, depthWrite: false, ...options })
