// 单词屋的屋里：一间剖开的木屋（朝镜头的那面墙和屋顶拿掉）。壁炉、书桌和绒布板、书架、留声机、窗、门。
// 只分白天黑夜，不跟森林的四季。屋里的东西各管一件事，见 ui/lodge.js
import * as THREE from 'three'
import { at, mat, seeded, shade } from '../look.js'

// 窗外的天、松树、月亮：昼夜是连续变的，这几样各用一份材质，frame 里按夜的深浅调
const SKY = new THREE.MeshBasicMaterial()
const PINES = new THREE.MeshBasicMaterial()
const MOON = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: '#F4EFD8', transparent: true }))
const TONES = { sky: [new THREE.Color('#BFE4F0'), new THREE.Color('#1B3247')], pines: [new THREE.Color('#5FA57A'), new THREE.Color('#10222C')], sun: [new THREE.Color('#FFF1D6'), new THREE.Color('#9DB6DC')] }

// tall：屋檐（两边墙）的高度；peak：后墙山尖的高度
const ROOM = { wide: 12, deep: 8, tall: 4.6, peak: 7.2 }
// 后墙朝屋里那一面的 z
const BACK = -ROOM.deep / 2
const WOOD = { wall: '#C69C70', seam: '#A98258', floor: '#A27C55', plank: '#8C6A49', dark: '#6B4A36', desk: '#8C6645', beam: '#7A4B3E' }
const BOOKS = ['#3F6B55', '#E9B949', '#B8463B', '#26302B', '#A9C4B4', '#D9A531', '#4E7FA8', '#F3EFE4']
// 右边要给窗帘让出位置，所以板子比书桌窄一点
const BOARD = { x: 0, y: 2.95, wide: 5.4, tall: 2.2 }
const VIEWS = {
  room: { from: [0, 6.4, 13.4], to: [0, 2.6, -1.4] },
  desk: { from: [0.3, 2.75, 2.2], to: [0.3, 2.75, BACK] },
  listen: { from: [3.6, 3.0, 4.8], to: [-1.2, 1.55, -1.3] },
}

const paints = new Map()
const paint = color => paints.get(color) ?? paints.set(color, mat(color)).get(color)
const box = (wide, tall, deep, color, x, y, z) => shade(at(new THREE.Mesh(new THREE.BoxGeometry(wide, tall, deep), paint(color)), x, y, z))
const rod = (top, bottom, tall, color, x, y, z, sides = 10) => shade(at(new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, tall, sides), paint(color)), x, y, z))
// 墙、地板、地毯只接影子不投影子：窗外来的光是从后墙那边照进来的，墙一投影屋里就全黑了
const quiet = mesh => { mesh.castShadow = false; return mesh }

function shell() {
  const group = new THREE.Group()
  const { wide, deep, tall } = ROOM
  group.add(quiet(box(wide + 0.6, 0.3, deep + 0.3, WOOD.floor, 0, -0.15, -0.15)))
  for (let x = -wide / 2 + 1; x < wide / 2; x++) group.add(quiet(box(0.035, 0.01, deep, WOOD.plank, x, 0.005, 0)))
  group.add(quiet(box(wide + 0.6, tall, 0.3, WOOD.wall, 0, tall / 2, BACK - 0.15)))
  for (const side of [-1, 1]) group.add(quiet(box(0.3, tall, deep, WOOD.wall, side * (wide / 2 + 0.15), tall / 2, 0)))
  // 原木墙一道一道的缝
  for (let y = 0.58; y < tall; y += 0.58) {
    group.add(quiet(box(wide, 0.045, 0.02, WOOD.seam, 0, y, BACK + 0.01)))
    for (const side of [-1, 1]) group.add(quiet(box(0.02, 0.045, deep, WOOD.seam, side * (wide / 2 - 0.01), y, 0)))
  }
  for (const side of [-1, 1]) group.add(quiet(box(0.42, 0.2, deep + 0.3, WOOD.beam, side * (wide / 2 + 0.15), tall + 0.1, -0.15)))
  group.add(gable())
  return group
}

/// 后墙上面的山尖：一块三角的墙、两根斜梁、一扇小圆窗
function gable() {
  const group = new THREE.Group()
  const { wide, tall, peak } = ROOM
  const half = wide / 2 + 0.3
  const rise = peak - tall
  const outline = new THREE.Shape()
  outline.moveTo(-half, 0); outline.lineTo(half, 0); outline.lineTo(0, rise)
  group.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.3, bevelEnabled: false }), paint(WOOD.wall)), 0, tall, BACK - 0.3))
  for (let y = 0.58 * Math.ceil(tall / 0.58); y < peak - 0.3; y += 0.58) group.add(quiet(box(2 * half * (peak - y) / rise - 0.5, 0.045, 0.02, WOOD.seam, 0, y, BACK + 0.01)))
  const slope = Math.atan2(rise, half)
  for (const side of [-1, 1]) { const beam = quiet(box(Math.hypot(half, rise) + 0.3, 0.26, 0.5, WOOD.beam, side * half / 2, tall + rise / 2 + 0.1, BACK - 0.1)); beam.rotation.z = -side * slope; group.add(beam) }
  const rim = quiet(rod(0.66, 0.66, 0.12, WOOD.dark, 0, tall + 1.05, BACK + 0.06, 28))
  rim.rotation.x = Math.PI / 2
  group.add(rim, at(new THREE.Mesh(new THREE.CircleGeometry(0.54, 28), SKY), 0, tall + 1.05, BACK + 0.125),
    box(0.06, 1.08, 0.04, WOOD.dark, 0, tall + 1.05, BACK + 0.14), box(1.08, 0.06, 0.04, WOOD.dark, 0, tall + 1.05, BACK + 0.14))
  return group
}

/// 左墙的石头壁炉。返回火苗和火光，好让它们一跳一跳
function fireplace() {
  const group = new THREE.Group()
  const x = -ROOM.wide / 2
  const z = -0.4
  const stone = '#9BA4A9'
  // 炉膛是真的空出来的：两边两根柱、上面一整块、里面一块黑的背板，火在洞里烧
  for (const side of [-1, 1]) group.add(box(1.0, 1.5, 0.65, stone, x + 0.5, 0.75, z + side * 1.075))
  group.add(box(1.0, ROOM.tall - 1.5, 2.8, stone, x + 0.5, 1.5 + (ROOM.tall - 1.5) / 2, z), box(0.2, 1.5, 1.5, '#2A2522', x + 0.1, 0.75, z),
    box(1.7, 0.16, 3.4, '#7F8990', x + 0.85, 0.08, z), box(1.35, 0.16, 3.2, WOOD.dark, x + 0.62, 1.86, z))
  // 一层一层砌的石缝：横缝通长，竖缝隔一层错开半块
  const mortar = '#838C92'
  for (let row = 1; row * 0.46 < ROOM.tall; row++) {
    const y = row * 0.46
    group.add(box(0.02, 0.035, 2.8, mortar, x + 1.005, y, z), box(1.0, 0.035, 0.02, mortar, x + 0.5, y, z + 1.405))
    for (let dz = -1.4 + (row % 2 ? 0.35 : 0.7); dz < 1.4; dz += 0.7) {
      if (y < 1.6 && Math.abs(dz) < 0.78) continue
      group.add(box(0.02, 0.46, 0.035, mortar, x + 1.005, y - 0.23, z + dz))
    }
  }
  for (const [dz, turn] of [[-0.22, 0.3], [0.22, -0.4]]) { const log = rod(0.1, 0.1, 0.8, '#5B4334', x + 0.6, 0.27, z + dz, 7); log.rotation.set(Math.PI / 2, 0, turn); group.add(log) }
  // 壁炉边上码着的柴
  for (const [dy, dz] of [[0, -0.24], [0, 0], [0, 0.24], [0.2, -0.12], [0.2, 0.12]]) { const log = rod(0.11, 0.11, 0.8, '#7A5C46', x + 0.5, 0.12 + dy, z - 1.95 + dz, 7); log.rotation.z = Math.PI / 2; group.add(log) }
  const flames = [['#F28A2E', 0.3, 0.8, 0], ['#F7C948', 0.2, 0.58, 0.12], ['#FBE38A', 0.11, 0.38, -0.08]].map(([color, radius, tall, dz]) =>
    at(new THREE.Mesh(new THREE.ConeGeometry(radius, tall, 6), new THREE.MeshBasicMaterial({ color })), x + 0.6, 0.36 + tall / 2, z + dz))
  // 火光放在炉膛口外面一点：放在洞里的话光全被两根柱挡住，照不到屋里
  const glow = at(new THREE.PointLight('#FF9A4A', 0, 16, 1.6), x + 1.7, 0.9, z)
  group.add(...flames, glow)
  return { group, flames, glow }
}

/// 壁炉前的一角：圆地毯、一把朝着火的扶手椅
function lounge() {
  const group = new THREE.Group()
  for (const [radius, color, y] of [[2.3, '#3F6B55', 0.012], [1.95, '#F3E7C4', 0.02], [1.15, '#E9B949', 0.028]]) group.add(quiet(rod(radius, radius, 0.02, color, -2.7, y, 0.5, 40)))
  const chair = new THREE.Group()
  chair.add(box(1.1, 0.42, 1.0, '#3F6B55', 0, 0.5, 0), box(1.1, 1.0, 0.24, '#3F6B55', 0, 0.98, -0.5), box(0.7, 0.2, 0.6, '#E9B949', 0, 0.8, -0.05))
  for (const side of [-1, 1]) chair.add(box(0.22, 0.6, 1.0, '#35594A', side * 0.62, 0.72, 0))
  for (const [dx, dz] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]]) chair.add(rod(0.05, 0.04, 0.3, WOOD.dark, dx, 0.15, dz, 6))
  chair.position.set(-2.5, 0, 1.6)
  chair.rotation.y = Math.atan2(-2.6, -2.0)
  group.add(chair)
  return group
}

/// 壁炉和后墙之间的墙角：一只矮柜，上面是留声机（听单词）
function gramophone() {
  const group = new THREE.Group()
  const x = -5.05
  const z = BACK + 0.5
  const brass = new THREE.MeshStandardMaterial({ color: '#D9A531', flatShading: true, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide })
  const horn = shade(at(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.62, 12, 1, true), brass), x + 0.14, 1.56, z + 0.16))
  // 喇叭口朝上、朝屋里
  horn.rotation.set(Math.PI + 0.75, 0, 0.45)
  group.add(box(1.0, 0.85, 0.75, WOOD.dark, x, 0.425, z), box(1.08, 0.06, 0.83, WOOD.desk, x, 0.88, z), box(0.52, 0.2, 0.52, WOOD.desk, x, 1.01, z), rod(0.21, 0.21, 0.03, '#26302B', x, 1.125, z, 20), horn)
  return group
}

/// 后墙底下的长书桌：台灯、今天要学的那叠卡片、杯子、一盆草、凳子。返回台灯的光
function desk() {
  const group = new THREE.Group()
  const z = BACK + 0.72
  group.add(box(5.6, 0.12, 1.2, WOOD.desk, 0.5, 0.95, z), box(1.3, 0.55, 1.05, WOOD.dark, 2.55, 0.62, z))
  for (const [x, dz] of [[-2.15, -0.45], [-2.15, 0.45], [3.15, -0.45], [3.15, 0.45]]) group.add(rod(0.06, 0.05, 0.9, WOOD.dark, x, 0.45, z + dz, 6))
  const shadeCone = shade(at(new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.34, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#3F6B55', flatShading: true, roughness: 1, side: THREE.DoubleSide })), -1.8, 1.72, z))
  const lamp = at(new THREE.PointLight('#FFD9A0', 0, 8, 1.7), -1.8, 1.6, z + 0.25)
  group.add(rod(0.16, 0.2, 0.06, '#26302B', -1.8, 1.04, z), rod(0.03, 0.03, 0.6, '#26302B', -1.8, 1.34, z, 6), shadeCone, lamp,
    at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#FFE9B0' })), -1.8, 1.62, z))
  // 今天要学的卡片：一叠纸，每张歪一点
  for (let k = 0; k < 7; k++) { const card = box(0.62, 0.018, 0.42, '#FBF8F1', 1.1, 1.02 + k * 0.019, z + 0.1); card.rotation.y = Math.sin(k * 2.3) * 0.16; group.add(card) }
  group.add(rod(0.09, 0.08, 0.2, '#E9B949', 2.0, 1.11, z + 0.25), box(0.5, 0.07, 0.36, '#3F6B55', 2.75, 1.045, z), box(0.46, 0.07, 0.34, '#B8463B', 2.72, 1.115, z + 0.02))
  group.add(rod(0.34, 0.34, 0.08, WOOD.desk, -1.3, 0.44, BACK + 1.85, 16))
  for (const turn of [0, 2.1, 4.2]) group.add(rod(0.04, 0.04, 0.42, WOOD.dark, -1.3 + Math.cos(turn) * 0.22, 0.21, BACK + 1.85 + Math.sin(turn) * 0.22, 6))
  return { group, lamp }
}

/// 一张写着词的纸条的贴图
function noteTexture(word) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 200
  const context = canvas.getContext('2d')
  context.fillStyle = '#FBF8F1'
  context.fillRect(0, 0, 320, 200)
  context.fillStyle = '#26302B'
  let size = 58
  // 词长了就把字缩小，别写出纸条
  do { context.font = `700 ${size}px Charter, Georgia, serif`; size -= 4 } while (context.measureText(word).width > 280 && size > 20)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(word, 160, 108)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/// 后墙书桌上方的一块大绒布板：学会的词写成纸条钉在上面，五列三行最多十五张
function board() {
  const group = new THREE.Group()
  const notes = new THREE.Group()
  const { x, y, wide, tall } = BOARD
  const pin = new THREE.MeshBasicMaterial({ color: '#E9B949' })
  group.add(box(wide + 0.24, tall + 0.24, 0.08, WOOD.dark, x, y, BACK + 0.04), quiet(box(wide, tall, 0.03, '#3F6B55', x, y, BACK + 0.085)), notes)
  let shown = null

  function set(words) {
    // 没变就不重画：每张纸条都要现画一张贴图
    if (words.join() === shown) return
    shown = words.join()
    for (const child of notes.children) if (child.material !== pin) { child.material.map.dispose(); child.material.dispose() }
    notes.clear()
    const random = seeded(5)
    words.slice(0, 15).forEach((word, k) => {
      const texture = noteTexture(word)
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.52), new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.08, roughness: 1 }))
      // 每张歪一点、错开一点，像随手钉的
      note.position.set(x - wide / 2 + 0.62 + (k % 5) * 1.04 + random.between(-0.06, 0.06), y + tall / 2 - 0.42 - Math.floor(k / 5) * 0.68 + random.between(-0.04, 0.04), BACK + 0.105)
      note.rotation.z = random.between(-0.06, 0.06)
      notes.add(note, at(new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), pin), note.position.x, note.position.y + 0.2, BACK + 0.11))
    })
  }
  /// 夜里只有炉火和台灯，纸条自己带一点亮才看得清字
  const glow = night => { for (const child of notes.children) if (child.material !== pin) child.material.emissiveIntensity = 0.08 + night * 0.27 }
  return { group, set, glow }
}

/// 后墙右边的窗：只分白天和黑夜，不跟森林的四季。天色、松树、月亮在 frame 里跟着昼夜变
function windowBack() {
  const group = new THREE.Group()
  const x = 4.4
  const y = 2.75
  const size = 2.0
  group.add(box(size + 0.3, size + 0.3, 0.12, WOOD.dark, x, y, BACK + 0.06), at(new THREE.Mesh(new THREE.PlaneGeometry(size, size), SKY), x, y, BACK + 0.125))
  // 窗外的几棵松树：贴在玻璃上的三角
  for (const [dx, tall, wide] of [[-0.55, 1.5, 0.8], [0.08, 1.15, 0.66], [0.56, 1.7, 0.84]]) {
    const tree = new THREE.Shape()
    tree.moveTo(-wide / 2, 0); tree.lineTo(0, tall); tree.lineTo(wide / 2, 0)
    group.add(at(new THREE.Mesh(new THREE.ShapeGeometry(tree), PINES), x + dx, y - size / 2, BACK + 0.13))
  }
  group.add(at(MOON, x - 0.18, y + 0.62, BACK + 0.128))
  group.add(box(0.07, size, 0.05, WOOD.dark, x, y, BACK + 0.15), box(size, 0.07, 0.05, WOOD.dark, x, y, BACK + 0.15), box(size + 0.5, 0.1, 0.34, WOOD.dark, x, y - size / 2 - 0.2, BACK + 0.17))
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) group.add(box(0.14, size + 0.5, 0.1, k % 2 ? '#E2C36B' : '#E9CC7A', x + side * (size / 2 + 0.12 + k * 0.13), y + 0.05, BACK + 0.2 + (k % 2) * 0.04))
  group.add(box(size + 1.2, 0.07, 0.07, WOOD.dark, x, y + size / 2 + 0.36, BACK + 0.2), rod(0.13, 0.1, 0.2, '#B8663B', x - 0.6, y - size / 2 - 0.05, BACK + 0.2))
  for (const [dx, dy, radius] of [[0, 0.26, 0.2], [-0.12, 0.17, 0.15], [0.13, 0.19, 0.16]]) group.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), paint('#4FA058')), x - 0.6 + dx, y - size / 2 + 0.05 + dy, BACK + 0.2)))
  return group
}

/// 右墙的书架。书一直是满的：没学到的是白皮书，学过的才有颜色
function bookshelf() {
  const group = new THREE.Group()
  const x = ROOM.wide / 2
  const from = -3.5
  const long = 3.8
  const tall = 3.8
  const rows = 5
  const step = tall / rows
  group.add(box(0.08, tall, long, WOOD.desk, x - 0.04, tall / 2, from + long / 2))
  for (const z of [from, from + long]) group.add(box(0.5, tall, 0.1, WOOD.dark, x - 0.25, tall / 2, z))
  for (let row = 0; row <= rows; row++) group.add(box(0.5, 0.08, long, WOOD.dark, x - 0.25, Math.max(0.04, row * step), from + long / 2))
  const random = seeded(11)
  const spots = []
  for (let row = rows - 1; row >= 0; row--) for (let z = from + 0.14; z < from + long - 0.22;) { const thick = random.between(0.08, 0.17); spots.push({ row, z: z + thick / 2, thick, tall: random.between(0.42, 0.62), color: random.pick(BOOKS) }); z += thick + 0.012 }
  const books = shade(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), spots.length))
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  spots.forEach((book, k) => {
    dummy.position.set(x - 0.3, book.row * step + 0.08 + book.tall / 2, book.z)
    dummy.scale.set(0.34, book.tall, book.thick)
    dummy.updateMatrix()
    books.setMatrixAt(k, dummy.matrix)
  })
  /// fill：学过几成。从最上一层的里头往外、一层层往下上色
  function set(fill) {
    const learned = Math.round(spots.length * fill)
    spots.forEach((book, k) => books.setColorAt(k, tint.set(k < learned ? book.color : '#DDD3BE')))
    books.instanceColor.needsUpdate = true
  }
  set(0)
  group.add(books)
  return { group, set }
}

function door() {
  const group = new THREE.Group()
  const x = ROOM.wide / 2
  const z = 1.5
  group.add(box(0.1, 2.75, 1.6, WOOD.dark, x - 0.05, 1.375, z), box(0.08, 2.5, 1.3, '#5B3F2E', x - 0.11, 1.25, z),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), paint('#D9A531')), x - 0.18, 1.2, z - 0.45), quiet(box(1.1, 0.03, 1.5, '#3F6B55', x - 0.8, 0.015, z)))
  return group
}

/// 屋里的光。返回一个函数：按夜的深浅（0 白天，1 深夜）调亮度
function lights(scene) {
  const hemi = new THREE.HemisphereLight('#FFF3DF', '#7A6450', 1.25)
  // 窗外来的光：白天是太阳，夜里是很淡的月光
  const sun = at(new THREE.DirectionalLight('#FFF1D6', 1.9), 7, 9, -3)
  sun.target.position.set(-1, 0, 1.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.normalBias = 0.03
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: 1, far: 30 })
  // 从镜头这边补一点光，不然朝镜头的面全是黑的
  const fill = at(new THREE.DirectionalLight('#FFE9CF', 0.7), 0, 6, 12)
  scene.add(hemi, sun, sun.target, fill)
  return night => {
    hemi.intensity = 1.25 - 0.93 * night
    sun.intensity = 1.9 - 1.6 * night
    sun.color.lerpColors(...TONES.sun, night)
    fill.intensity = 0.7 - 0.48 * night
  }
}

// 小陈在屋里走的地面：一块平地，四面是墙。走得比森林里慢，人按家具的尺寸缩一点
// （森林里的房子是照着他的大头做的，屋里的桌椅是照着真人的尺寸做的）
export const ROOM_GROUND = { x: 5.0, north: -3.3, south: 3.5, height: () => 0, start: { x: 4.4, z: 1.5 }, speed: 5, size: 0.9 }
// 家具挡路的地方：书桌一排、壁炉一排、扶手椅、放留声机的矮柜
export const ROOM_COLLIDERS = [[-1.9, -3.3, 0.45], [-0.8, -3.3, 0.45], [0.3, -3.3, 0.45], [1.4, -3.3, 0.45], [2.5, -3.3, 0.45], [3.0, -3.3, 0.45], [-5.4, -1.3, 0.9], [-5.4, -0.4, 0.9], [-5.4, 0.5, 0.9], [-2.5, 1.6, 0.5], [-5.05, -3.5, 0.6]].map(([x, z, r]) => ({ x, z, r }))
// 屋里几样能用的东西在哪儿：position 是东西本身（牌子飘在它头顶 height 那么高），spot 是人走过去站的地方
export const PLACES = {
  desk: { position: [0.5, 0, BACK + 0.7], height: 0.75, radius: 2.2, reach: 2.6, spot: [-0.4, BACK + 1.9] },
  shelf: { position: [5.6, 0, -1.6], height: 3.9, radius: 1.6, reach: 2.2, spot: [4.4, -1.6] },
  gramophone: { position: [-5.05, 0, BACK + 0.5], height: 1.6, radius: 0.9, reach: 2.0, spot: [-3.9, -2.4] },
  door: { position: [5.9, 0, 1.5], height: 2.6, radius: 1.0, reach: 1.8, spot: [4.7, 1.5] },
}
// 坐的地方：[x, 离地多高, z, 脸朝哪儿]。书桌前的凳子（脸朝墙）、壁炉前的扶手椅（脸朝火）
export const SEATS = { desk: [-1.3, -0.08, BACK + 1.85, Math.PI], listen: [-2.5, 0.42, 1.6, Math.atan2(-2.6, -2.0)] }

export function createRoom() {
  const scene = new THREE.Scene()
  const fire = fireplace()
  const work = desk()
  const wall = board()
  const shelf = bookshelf()
  scene.add(shell(), fire.group, lounge(), gramophone(), work.group, wall.group, windowBack(), shelf.group, door())
  const dim = lights(scene)
  const eye = { from: new THREE.Vector3(), to: new THREE.Vector3(), view: 'room', fresh: true }
  const goal = { from: new THREE.Vector3(), to: new THREE.Vector3() }

  return {
    scene, setNotes: wall.set, setShelf: shelf.set,
    /// 镜头看哪儿：room 屋内全景、desk 书桌前、listen 壁炉前。snap：不慢慢移过去，直接到位
    look(view, snap = false) { eye.view = view; eye.fresh ||= snap },
    frame(camera, dt, time, night) {
      SKY.color.lerpColors(...TONES.sky, night)
      PINES.color.lerpColors(...TONES.pines, night)
      MOON.material.opacity = night
      dim(night)
      wall.glow(night)
      work.lamp.intensity = 2.5 + 7.5 * night
      fire.glow.intensity = (9 + 21 * night) * (0.86 + 0.14 * Math.sin(time * 9.1) * Math.sin(time * 5.3))
      fire.flames.forEach((flame, k) => { flame.scale.y = 1 + 0.16 * Math.sin(time * (7 + k * 2.3) + k); flame.rotation.y = time * (0.8 + k * 0.4) })
      goal.to.set(...VIEWS[eye.view].to)
      goal.from.set(...VIEWS[eye.view].from)
      // 竖屏窄，全景装不下一整间屋：镜头沿着视线往后退
      if (eye.view === 'room') goal.from.sub(goal.to).multiplyScalar(Math.max(1, 1.45 / camera.aspect)).add(goal.to)
      const ease = eye.fresh ? 1 : 1 - Math.exp(-4 * dt)
      eye.fresh = false
      eye.from.lerp(goal.from, ease)
      eye.to.lerp(goal.to, ease)
      camera.position.copy(eye.from)
      camera.lookAt(eye.to)
    },
  }
}
