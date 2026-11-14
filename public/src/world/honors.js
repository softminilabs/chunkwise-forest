// 荣誉墙：书桌上方那块绒布板上的内容。长成了的每一棵是一张钉着的小卡片，顶上一行字。
// 整块板画在一张画布上再贴上去：卡片有几百张也只是一张贴图，字也好排
import * as THREE from 'three'

const FONT = 'Charter, "Songti SC", "Noto Serif CJK SC", Georgia, serif'
// 画布的宽。高按板子的长宽比算
const WIDE = 2048
const EDGE = 40
const HEAD = 150
// 卡片的宽 ÷ 高，和一张卡片最大多高（树少的时候不把一张卡片撑满整块板）
const CARD = { aspect: 0.8, tall: 520, gap: 26 }

/// 这么多张卡片排几行、每张多高：一行排得下就一行，排不下加一行、卡片跟着缩（和「岁时」排松树一个办法）
function fit(count, wide, tall) {
  for (let rows = 1; ; rows++) {
    const high = Math.min(CARD.tall, (tall - (rows - 1) * CARD.gap) / rows)
    const cols = Math.floor((wide + CARD.gap) / (high * CARD.aspect + CARD.gap))
    if (rows * cols >= count) return { rows, cols: Math.min(cols, Math.ceil(count / rows)), high }
  }
}

function rounded(context, x, y, wide, tall, radius) {
  context.beginPath()
  context.roundRect(x, y, wide, tall, radius)
  context.fill()
}

function drawHead(context, { title, stats }) {
  context.fillStyle = '#FBF8F1'
  rounded(context, EDGE, EDGE, WIDE - EDGE * 2, HEAD, 14)
  context.textBaseline = 'middle'
  context.fillStyle = '#26302B'
  // 字要大：屋里全景下整块板在屏幕上只有四百多像素宽
  context.font = `800 96px ${FONT}`
  context.textAlign = 'left'
  context.fillText(title, EDGE + 44, EDGE + HEAD / 2 + 5)
  context.fillStyle = '#5B655F'
  context.font = `700 62px ${FONT}`
  context.textAlign = 'right'
  context.fillText(stats, WIDE - EDGE - 44, EDGE + HEAD / 2 + 5)
}

/// 一张卡片：米白的纸、一颗图钉、那棵长成的样子
function drawCard(context, image, x, y, wide, high) {
  context.fillStyle = '#FBF8F1'
  rounded(context, x, y, wide, high, high * 0.05)
  context.drawImage(image, x, y, wide, high)
  context.fillStyle = '#E9B949'
  context.beginPath()
  context.arc(x + wide / 2, y + high * 0.045, Math.max(5, high * 0.028), 0, Math.PI * 2)
  context.fill()
}

/// wide、tall：板子的大小（米）。返回贴在绒布上的那一片
export function createHonors(wide, tall) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDE
  canvas.height = Math.round(WIDE * tall / wide)
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.08, roughness: 1 })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wide, tall), material)
  let shown = null

  return {
    mesh,
    /// title、stats：顶上那行左右两段字；empty：一张卡片都没有时板子中间写的话；cards：[{ id, image }]，先长成的在前
    set({ title, stats, empty, cards }) {
      // 没变就不重画
      const key = JSON.stringify([title, stats, empty, cards.map(card => card.id)])
      if (key === shown) return
      shown = key
      context.clearRect(0, 0, canvas.width, canvas.height)
      drawHead(context, { title, stats })
      const top = EDGE + HEAD + 30
      const area = [WIDE - EDGE * 2, canvas.height - top - EDGE]
      if (!cards.length) {
        context.fillStyle = 'rgb(251 248 241 / .75)'
        context.font = `700 84px ${FONT}`
        context.textAlign = 'center'
        context.fillText(empty, WIDE / 2, top + area[1] / 2)
      } else {
        const { rows, cols, high } = fit(cards.length, ...area)
        const cardWide = high * CARD.aspect
        // 整块居中
        const left = (WIDE - cols * cardWide - (cols - 1) * CARD.gap) / 2
        const start = top + (area[1] - rows * high - (rows - 1) * CARD.gap) / 2
        cards.forEach((card, k) => drawCard(context, card.image, left + (k % cols) * (cardWide + CARD.gap), start + Math.floor(k / cols) * (high + CARD.gap), cardWide, high))
      }
      texture.needsUpdate = true
    },
    /// 夜里只有炉火和台灯，板上的东西自己带一点亮才看得清
    glow(night) { material.emissiveIntensity = 0.08 + night * 0.27 },
  }
}
