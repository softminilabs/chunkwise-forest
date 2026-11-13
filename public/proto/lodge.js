// 单词屋屋内的样张：一间剖开的木屋（朝镜头的那面墙和屋顶拿掉），看整体的布局、素材和光。
// ?view=room 屋内全景，?view=desk 坐到书桌前，?view=listen 坐到壁炉前听词；?time=night 看夜里；
// ?card=today|front|back|done 书桌前那张纸上是什么；?page=library|detail 点书架出来的词库大页面
import * as THREE from 'three'
import { at, mat, seeded, shade } from '../src/look.js'
import { startLibrary } from './lodge-words.js'

const params = new URLSearchParams(location.search)
const night = params.get('time') === 'night'
const view = ['desk', 'listen'].includes(params.get('view')) ? params.get('view') : 'room'
document.body.dataset.view = view
document.body.dataset.time = night ? 'night' : 'day'
document.body.dataset.card = params.get('card') ?? ''
document.body.dataset.page = params.get('page') ?? ''
document.body.dataset.sheet = view === 'listen' ? 'listen' : params.get('card') === 'today' ? 'today' : 'word'

// tall：屋檐（两边墙）的高度；peak：后墙山尖的高度
const ROOM = { wide: 12, deep: 8, tall: 4.6, peak: 7.2 }
// 后墙朝屋里那一面的 z
const BACK = -ROOM.deep / 2
const WOOD = { wall: '#C69C70', seam: '#A98258', floor: '#A27C55', plank: '#8C6A49', dark: '#6B4A36', desk: '#8C6645', beam: '#7A4B3E' }
const BOOKS = ['#3F6B55', '#E9B949', '#B8463B', '#26302B', '#A9C4B4', '#D9A531', '#4E7FA8', '#F3EFE4']
// 后墙那块绒布板上钉的纸条：学会的词。先不放插图，只写词
const NOTES = ['queue', 'ladder', 'flour', 'recipe', 'cyclist', 'yoga', 'ceiling', 'handle', 'tin', 'ripe', 'brilliant', 'grocery', 'delivery']
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
  group.add(rim, at(new THREE.Mesh(new THREE.CircleGeometry(0.54, 28), new THREE.MeshBasicMaterial({ color: night ? '#1B3247' : '#BFE4F0' })), 0, tall + 1.05, BACK + 0.125),
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

/// 壁炉和后墙之间的墙角：一只矮柜，上面是留声机（以后的「听词」）
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
  context.font = '700 58px Charter, Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(word, 160, 108)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/// 后墙书桌上方的一块大绒布板：学会的词写成纸条钉在上面。count：钉了几张
function board(count) {
  const group = new THREE.Group()
  const { x, y, wide, tall } = BOARD
  group.add(box(wide + 0.24, tall + 0.24, 0.08, WOOD.dark, x, y, BACK + 0.04), quiet(box(wide, tall, 0.03, '#3F6B55', x, y, BACK + 0.085)))
  const random = seeded(5)
  NOTES.slice(0, count).forEach((word, k) => {
    const texture = noteTexture(word)
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.52), new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: night ? 0.35 : 0.08, roughness: 1 }))
    // 五列三行的格子，每张歪一点、错开一点，像随手钉的
    note.position.set(x - wide / 2 + 0.62 + (k % 5) * 1.04 + random.between(-0.06, 0.06), y + tall / 2 - 0.42 - Math.floor(k / 5) * 0.68 + random.between(-0.04, 0.04), BACK + 0.105)
    note.rotation.z = random.between(-0.06, 0.06)
    group.add(note, at(new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: '#E9B949' })), note.position.x, note.position.y + 0.2, BACK + 0.11))
  })
  return group
}

/// 后墙右边的窗：只分白天和黑夜，不跟森林的四季
function windowBack() {
  const group = new THREE.Group()
  const x = 4.4
  const y = 2.75
  const size = 2.0
  const flat = color => new THREE.MeshBasicMaterial({ color })
  group.add(box(size + 0.3, size + 0.3, 0.12, WOOD.dark, x, y, BACK + 0.06), at(new THREE.Mesh(new THREE.PlaneGeometry(size, size), flat(night ? '#1B3247' : '#BFE4F0')), x, y, BACK + 0.125))
  // 窗外的几棵松树：贴在玻璃上的三角
  for (const [dx, tall, wide] of [[-0.55, 1.5, 0.8], [0.08, 1.15, 0.66], [0.56, 1.7, 0.84]]) {
    const tree = new THREE.Shape()
    tree.moveTo(-wide / 2, 0); tree.lineTo(0, tall); tree.lineTo(wide / 2, 0)
    group.add(at(new THREE.Mesh(new THREE.ShapeGeometry(tree), flat(night ? '#10222C' : '#5FA57A')), x + dx, y - size / 2, BACK + 0.13))
  }
  if (night) group.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), flat('#F4EFD8')), x - 0.18, y + 0.62, BACK + 0.128))
  group.add(box(0.07, size, 0.05, WOOD.dark, x, y, BACK + 0.15), box(size, 0.07, 0.05, WOOD.dark, x, y, BACK + 0.15), box(size + 0.5, 0.1, 0.34, WOOD.dark, x, y - size / 2 - 0.2, BACK + 0.17))
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) group.add(box(0.14, size + 0.5, 0.1, k % 2 ? '#E2C36B' : '#E9CC7A', x + side * (size / 2 + 0.12 + k * 0.13), y + 0.05, BACK + 0.2 + (k % 2) * 0.04))
  group.add(box(size + 1.2, 0.07, 0.07, WOOD.dark, x, y + size / 2 + 0.36, BACK + 0.2), rod(0.13, 0.1, 0.2, '#B8663B', x - 0.6, y - size / 2 - 0.05, BACK + 0.2))
  for (const [dx, dy, radius] of [[0, 0.26, 0.2], [-0.12, 0.17, 0.15], [0.13, 0.19, 0.16]]) group.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), paint('#4FA058')), x - 0.6 + dx, y - size / 2 + 0.05 + dy, BACK + 0.2)))
  return group
}

/// 右墙的书架。书一直是满的：没学到的是白皮书，学过的才有颜色。fill：学过几成
function bookshelf(fill) {
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
  const learned = Math.round(spots.length * fill)
  const books = shade(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), spots.length))
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  spots.forEach((book, k) => {
    dummy.position.set(x - 0.3, book.row * step + 0.08 + book.tall / 2, book.z)
    dummy.scale.set(0.34, book.tall, book.thick)
    dummy.updateMatrix()
    books.setMatrixAt(k, dummy.matrix)
    books.setColorAt(k, tint.set(k < learned ? book.color : '#DDD3BE'))
  })
  group.add(books)
  return group
}

function door() {
  const group = new THREE.Group()
  const x = ROOM.wide / 2
  const z = 1.5
  group.add(box(0.1, 2.75, 1.6, WOOD.dark, x - 0.05, 1.375, z), box(0.08, 2.5, 1.3, '#5B3F2E', x - 0.11, 1.25, z),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), paint('#D9A531')), x - 0.18, 1.2, z - 0.45), quiet(box(1.1, 0.03, 1.5, '#3F6B55', x - 0.8, 0.015, z)))
  return group
}

/// 小陈。和 src/player.js 里的是同一个人，这里照抄一份（样张不动正式代码），个头按屋里的桌椅缩了一点。seated：坐着
function figure(seated) {
  const soft = color => new THREE.MeshStandardMaterial({ color, roughness: 1 })
  const limb = (color, x, y) => { const pivot = new THREE.Group(); pivot.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), soft(color)), 0, -0.28, 0))); return at(pivot, x, y, 0) }
  const legs = [-0.17, 0.17].map(x => limb('#3D4A5C', x, 0.6))
  const arms = [-0.46, 0.46].map(x => limb('#E0A63A', x, 1.36))
  const root = new THREE.Group()
  root.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 6, 12), soft('#E0A63A')), 0, 0.98, 0)), shade(at(new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), soft('#F7D9BF')), 0, 1.86, 0)),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), soft('#232323')), 0, 1.9, -0.03), at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.26), soft('#3F6B55')), 0, 1.02, -0.36), ...arms, ...legs)
  for (const x of [-0.15, 0.15]) root.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), soft('#232323')), x, 1.86, 0.4))
  root.scale.setScalar(0.9)
  if (seated) { for (const leg of legs) leg.rotation.x = -1.45; for (const arm of arms) arm.rotation.x = -1.0 }
  return root
}

function lights(scene) {
  scene.add(new THREE.HemisphereLight('#FFF3DF', '#7A6450', night ? 0.32 : 1.25))
  // 窗外来的光：白天是太阳，夜里是很淡的月光
  const sun = at(new THREE.DirectionalLight(night ? '#9DB6DC' : '#FFF1D6', night ? 0.3 : 1.9), 7, 9, -3)
  sun.target.position.set(-1, 0, 1.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.normalBias = 0.03
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: 1, far: 30 })
  // 从镜头这边补一点光，不然朝镜头的面全是黑的
  scene.add(sun, sun.target, at(new THREE.DirectionalLight('#FFE9CF', night ? 0.22 : 0.7), 0, 6, 12))
}

/// 屋里能用的东西头顶的牌子。和森林里一样：远的只有名字，走近的那个带一行说明和「空格」
const TAGS = [
  { at: [0.5, 1.6, BACK + 1.2], badge: '词', title: '今天的词', hint: '复习 12 个 · 新词 10 个', near: true },
  { at: [5.7, 4.2, -1.6], badge: '书', title: '词库', page: 'library' },
  { at: [-5.05, 2.35, BACK + 0.5], badge: '听', title: '听单词' },
  { at: [5.8, 3.1, 1.5], badge: '门', title: '回森林' },
]

function placeTags(camera) {
  const layer = document.getElementById('tags')
  const point = new THREE.Vector3()
  layer.replaceChildren(...TAGS.map(tag => {
    point.set(...tag.at).project(camera)
    const node = document.createElement('div')
    node.className = `tag${tag.near ? ' is-near' : ''}`
    node.innerHTML = `<b>${tag.badge}</b><span><strong>${tag.title}</strong>${tag.near ? `<small>${tag.hint}</small>` : ''}</span>${tag.near ? '<kbd>空格</kbd>' : ''}`
    node.style.left = `${(point.x + 1) / 2 * innerWidth}px`
    node.style.top = `${(1 - point.y) / 2 * innerHeight}px`
    if (tag.page) node.addEventListener('click', () => { document.body.dataset.page = tag.page })
    return node
  }))
}

/// 小陈在哪儿：全景里站在屋子中间，学词时坐在书桌前的凳子上，听词时坐在壁炉前的扶手椅里
function seat(chen) {
  if (view === 'desk') { chen.position.set(-1.3, -0.08, BACK + 1.85); chen.rotation.y = Math.PI }
  else if (view === 'listen') { chen.position.set(-2.5, 0.42, 1.6); chen.rotation.y = Math.atan2(-2.6, -2.0) }
  else { chen.position.set(2.4, 0, 1.2); chen.rotation.y = -0.5 }
}

function build(scene) {
  const fire = fireplace()
  const work = desk()
  const done = document.body.dataset.card === 'done'
  const chen = figure(view !== 'room')
  seat(chen)
  // 学完之后，今天的词也钉上去了
  scene.add(shell(), fire.group, lounge(), gramophone(), work.group, board(done ? NOTES.length : 9), windowBack(), bookshelf(done ? 0.1 : 0.093), door(), chen)
  lights(scene)
  return { fire, lamp: work.lamp }
}

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), antialias: true, alpha: true })
  renderer.shadowMap.enabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = night ? 1.25 : 1.05
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 200)
  const { fire, lamp } = build(scene)
  camera.position.set(...VIEWS[view].from)
  camera.lookAt(...VIEWS[view].to)
  const resize = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(innerWidth, innerHeight, false)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    if (view === 'room' && document.body.dataset.card !== 'done' && !document.body.dataset.page) placeTags(camera)
  }
  addEventListener('resize', resize)
  resize()
  lamp.intensity = night ? 10 : 2.5
  startLibrary()
  renderer.setAnimationLoop(ms => {
    const time = ms / 1000
    const flicker = 0.86 + 0.14 * Math.sin(time * 9.1) * Math.sin(time * 5.3)
    fire.glow.intensity = (night ? 30 : 9) * flicker
    fire.flames.forEach((flame, k) => { flame.scale.y = 1 + 0.16 * Math.sin(time * (7 + k * 2.3) + k); flame.rotation.y = time * (0.8 + k * 0.4) })
    renderer.render(scene, camera)
  })
}

start()
