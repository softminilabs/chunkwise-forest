// 森林的样张：只为看画风——一块林间空地、篝火、两间木屋、一只宝箱。
// 网址参数：?season=spring|summer|autumn|winter  &time=day|night  &weather=rain|snow|meteor
import * as THREE from 'three'

const query = new URLSearchParams(location.search)
const pick = (key, list) => list.includes(query.get(key)) ? query.get(key) : list[0]
const season = pick('season', ['autumn', 'spring', 'summer', 'winter'])
const night = pick('time', ['day', 'night']) === 'night'
const weather = pick('weather', ['clear', 'rain', 'snow', 'meteor'])

// 每个季节：天（上、下）、地面两个色、松树、阔叶树的几种色、小路、日光
const LOOK = {
  spring: { sky: ['#BFE1EE', '#EDF6EA'], ground: ['#A5D38C', '#B9DE9C'], pine: '#62A678', leaf: ['#BFE39B', '#F5BBCD', '#FAD7E2', '#A6D788'], path: '#E6D6B2', sun: '#FFF3DC', water: '#A9D5DE' },
  summer: { sky: ['#A3D5EC', '#E0F2E2'], ground: ['#74B868', '#8AC873'], pine: '#2F7554', leaf: ['#4FA058', '#6FBA63', '#3F8E56'], path: '#DDC99C', sun: '#FFFFFF', water: '#97CCD8' },
  autumn: { sky: ['#EFD3AE', '#F9EDDA'], ground: ['#AEB068', '#BFB267'], pine: '#4F7254', leaf: ['#E68B3B', '#D9573B', '#F2BE48', '#C96C2F'], path: '#E3CFA2', sun: '#FFE0B4', water: '#A6C9CD' },
  winter: { sky: ['#C6DAE9', '#EFF5F8'], ground: ['#F3F7F9', '#E4EDF2'], pine: '#3F685A', leaf: ['#E8F0F4'], path: '#DDE6EB', sun: '#F3F7FF', water: '#D5E8F0' },
}
const NIGHT_SKY = { spring: ['#0E1F30', '#213E4A'], summer: ['#0B1D2C', '#1B3D42'], autumn: ['#121A2E', '#2B3147'], winter: ['#111A2D', '#2B394F'] }
const look = LOOK[season]
const sky = night ? NIGHT_SKY[season] : look.sky

let seed = 20261113
const random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const between = (a, b) => a + (b - a) * random()
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1, metalness: 0, ...options })
const at = (object, x, y, z) => { object.position.set(x, y, z); return object }
const shade = (mesh, cast = true) => { mesh.castShadow = cast; mesh.receiveShadow = true; return mesh }

// 小路和小溪都是折线，地面按离它们多远来上色、压低
const PATH = [[1, 40], [2, 26], [-1, 14], [0, 6], [-3, 0], [-10, -6], [-16, -19], [-9, -40]]
const BRANCH = [[0, 6], [5, -1], [11, -8]]
const STREAM = [[42, -38], [25, -21], [19.5, -6], [13.5, 7], [14.5, 20], [21, 42]]
function distanceTo(line, x, z) {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i]
    const [bx, bz] = line[i + 1]
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)))
    best = Math.min(best, Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t))
  }
  return best
}
const nearPath = (x, z) => Math.min(distanceTo(PATH, x, z), distanceTo(BRANCH, x, z))
/// 地势：中间的空地是平的，往外有缓坡，远处抬起来成一圈小山，天边才不是一条直线
function height(x, z) {
  const far = Math.hypot(x, z)
  const rough = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 1.5 + Math.sin(x * 0.29 + z * 0.17) * 0.5
  return rough * smooth(13, 34, far) + Math.max(0, far - 46) * 0.2 - smooth(2.2, 0, distanceTo(STREAM, x, z)) * 0.8
}

function ground(scene) {
  const geometry = new THREE.PlaneGeometry(190, 190, 90, 90)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const [a, b, path, water, color] = [new THREE.Color(look.ground[0]), new THREE.Color(look.ground[1]), new THREE.Color(look.path), new THREE.Color(look.water), new THREE.Color()]
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    position.setY(i, height(x, z))
    color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.4 + Math.cos(z * 0.33) * 2))
    color.lerp(path, smooth(2.1, 0.9, nearPath(x, z)) * 0.9).lerp(path, smooth(9, 5.5, Math.hypot(x, z - 4)) * 0.55)
    color.lerp(water, smooth(2.0, 1.1, distanceTo(STREAM, x, z)))
    color.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, mat('#ffffff', { vertexColors: true }))
  mesh.receiveShadow = true
  scene.add(mesh)
}

/// 树：松树是三层叠起来的锥，阔叶树是两团。都用实例化，几百棵树只要几次绘制
function forest(scene) {
  const spots = []
  while (spots.length < 330) {
    const angle = random() * Math.PI * 2
    const far = 14 + Math.pow(random(), 0.75) * 74
    const x = Math.sin(angle) * far
    const z = Math.cos(angle) * far - 6
    if (nearPath(x, z) < 3.2 || distanceTo(STREAM, x, z) < 2.6 || Math.hypot(x + 11, z + 7) < 6.5 || Math.hypot(x - 12, z + 9) < 7.5 || Math.hypot(x - 7, z - 9) < 5 || (z > 3 && Math.abs(x - 1) < 13) || (z > 20 && Math.abs(x) < 20)) continue
    spots.push({ x, z, y: height(x, z), size: between(0.8, 1.5) * (1 + smooth(30, 80, far) * 0.5), pine: random() < (season === 'winter' ? 0.72 : 0.5), turn: random() * 6.28 })
  }
  const pines = spots.filter(spot => spot.pine)
  const leafy = spots.filter(spot => !spot.pine)
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  const layer = (geometry, material, list, place) => {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length)
    list.forEach((spot, i) => {
      dummy.position.set(spot.x, spot.y, spot.z)
      dummy.rotation.set(0, spot.turn, 0)
      dummy.scale.setScalar(spot.size)
      const color = place(spot, dummy, i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (color) mesh.setColorAt(i, color)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }
  const bark = mat(season === 'winter' ? '#6B5A50' : '#7A5C46')
  layer(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), bark, pines, (spot, node) => { node.position.y += 0.8 * spot.size })
  const pine = new THREE.Color(look.pine)
  const snow = new THREE.Color('#F4F8FA')
  // 冬天越往树尖越白，像落了雪
  ;[[1.5, 2.2, 1.9, 0.12], [1.15, 1.9, 3.1, 0.45], [0.8, 1.7, 4.2, 0.85]].forEach(([radius, tall, y, frost]) => {
    layer(new THREE.ConeGeometry(radius, tall, 7), mat('#ffffff'), pines, (spot, node) => { node.position.y += y * spot.size; return tint.copy(pine).offsetHSL(0, 0, (random() - 0.5) * 0.06).lerp(snow, season === 'winter' ? frost : 0).clone() })
  })
  layer(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), bark, leafy, (spot, node) => { node.position.y += 1.2 * spot.size })
  const crown = spot => tint.set(look.leaf[Math.floor(random() * look.leaf.length)]).offsetHSL(0, 0, (random() - 0.5) * 0.05).clone()
  const bare = season === 'winter' ? 0.42 : 1
  layer(new THREE.IcosahedronGeometry(1.5, 1), mat('#ffffff'), leafy, (spot, node) => { node.position.y += 3.2 * spot.size; node.scale.multiplyScalar(bare); node.scale.y *= 0.85; return crown(spot) })
  layer(new THREE.IcosahedronGeometry(1.0, 1), mat('#ffffff'), leafy, (spot, node) => { node.position.x += 0.9 * spot.size; node.position.y += 2.5 * spot.size; node.scale.multiplyScalar(bare); return crown(spot) })
}

/// 地上的零碎：灌木、石头，秋天的落叶、春天的花。量不多，只为不让地面是一整片平色
function litter(scene) {
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  const spread = (geometry, count, colors, place) => {
    const mesh = new THREE.InstancedMesh(geometry, mat('#ffffff'), count)
    for (let i = 0; i < count; i++) {
      let x = 0
      let z = 0
      do { x = between(-40, 40); z = between(-38, 30) } while (nearPath(x, z) < 1.6 || distanceTo(STREAM, x, z) < 1.4 || Math.hypot(x, z - 4) < 4.5)
      dummy.position.set(x, height(x, z), z)
      dummy.rotation.set(0, random() * 6.28, 0)
      dummy.scale.setScalar(1)
      place(dummy)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tint.set(colors[Math.floor(random() * colors.length)]))
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }
  spread(new THREE.IcosahedronGeometry(0.55, 1), 46, season === 'winter' ? ['#E8F0F4', '#DCE7EC'] : [look.pine, look.leaf[0]], node => { node.scale.set(between(0.8, 1.5), between(0.6, 0.9), between(0.8, 1.5)); node.position.y += 0.25 })
  spread(new THREE.IcosahedronGeometry(0.4, 0), 30, ['#9A9892', '#86847F', '#A7A6A0'], node => { node.scale.set(between(0.7, 1.8), between(0.5, 1.0), between(0.7, 1.5)); node.position.y += 0.12 })
  const flat = new THREE.CircleGeometry(0.2, 5)
  flat.rotateX(-Math.PI / 2)
  if (season === 'autumn') spread(flat, 260, look.leaf, node => { node.position.y += 0.05; node.scale.setScalar(between(0.7, 1.4)) })
  if (season === 'spring') spread(new THREE.ConeGeometry(0.13, 0.26, 5), 200, ['#F7A9C4', '#FFFFFF', '#F6D35B', '#C9A7F0'], node => { node.position.y += 0.2 })
  if (season === 'summer') spread(new THREE.ConeGeometry(0.1, 0.22, 5), 90, ['#FFFFFF', '#F6D35B'], node => { node.position.y += 0.18 })
}

function cabin(scene, x, z, turn, { wide = 5.4, tall = 2.9, lit = true, wall = '#A77F5C', roof = '#4E6E66' } = {}) {
  const home = new THREE.Group()
  const glow = night && lit
  const pane = new THREE.MeshStandardMaterial({ color: glow ? '#FFD98A' : '#DCE9EC', emissive: glow ? '#FFB84D' : '#000000', emissiveIntensity: glow ? 2.2 : 0, roughness: 0.6 })
  home.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(wide, tall, 4.4), mat(wall)), 0, tall / 2, 0)))
  for (let k = 1; k < 5; k++) home.add(at(new THREE.Mesh(new THREE.BoxGeometry(wide + 0.06, 0.05, 4.46), mat('#8B6648')), 0, k * tall / 5, 0))
  const pitch = new THREE.CylinderGeometry(1.5, 1.5, 5.2, 3)
  pitch.rotateX(-Math.PI / 2)
  pitch.scale((wide / 2 + 0.55) / 1.3, 0.82, 1)
  home.add(shade(at(new THREE.Mesh(pitch, mat(season === 'winter' ? '#F4F8FA' : roof)), 0, tall + 0.6, 0)))
  // 冬天屋顶盖着雪，檐口露出一条原来的颜色
  if (season === 'winter') { const eave = at(new THREE.Mesh(pitch, mat(roof)), 0, tall + 0.46, 0); eave.scale.set(1.02, 0.9, 1.02); home.add(eave) }
  home.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.14), mat('#5B4334')), 0, 0.95, 2.22))
  for (const side of [-1, 1]) home.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.12), pane), side * (wide / 2 - 1.15), 1.75, 2.22))
  home.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat('#8E8B86')), wide / 2 - 1.1, tall + 1.6, -0.9)))
  home.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.1), mat('#8B6648')), 0, 0.11, 2.75))
  if (glow || season === 'winter') [0, 1, 2].forEach(k => home.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 + k * 0.16, 1), new THREE.MeshStandardMaterial({ color: '#E9EEF0', transparent: true, opacity: 0.75 - k * 0.2, roughness: 1 })), wide / 2 - 1.1 + k * 0.35, tall + 3 + k * 0.9, -0.9)))
  if (glow) { const lamp = new THREE.PointLight('#FFB866', 26, 16, 2); home.add(at(lamp, 0, 1.9, 3.4)) }
  home.position.set(x, height(x, z), z)
  home.rotation.y = turn
  scene.add(home)
  return home
}

function campfire(scene, x, z) {
  const camp = new THREE.Group()
  for (let k = 0; k < 9; k++) camp.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(between(0.22, 0.34), 0), mat('#8F8D88')), Math.cos(k * 0.7) * 1.05, 0.14, Math.sin(k * 0.7) * 1.05)))
  for (const turn of [0.4, 1.5, 2.6]) { const log = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 6), mat('#6A4B37'))); log.rotation.set(Math.PI / 2 - 0.35, turn, 0); camp.add(at(log, 0, 0.32, 0)) }
  for (const [lx, lz, turn] of [[-3.1, 1.2, 0.5], [3.0, 1.4, -0.4], [0.2, 3.4, 1.57]]) { const seat = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.4, 8), mat('#8B6648'))); seat.rotation.set(0, turn, Math.PI / 2); camp.add(at(seat, lx, 0.42, lz)) }
  if (night) {
    const flame = (radius, tall, color, y) => at(new THREE.Mesh(new THREE.ConeGeometry(radius, tall, 5), new THREE.MeshBasicMaterial({ color })), 0, y, 0)
    camp.add(flame(0.5, 1.5, '#FF8A2B', 0.95), flame(0.32, 1.1, '#FFC24A', 0.85), flame(0.16, 0.7, '#FFF0B8', 0.75))
    camp.add(at(new THREE.PointLight('#FF9A45', 170, 46, 2), 0, 1.5, 0))
    const sparks = new THREE.BufferGeometry()
    sparks.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 36 }, (_, i) => i % 3 === 1 ? between(1.4, 4.6) : between(-0.7, 0.7))), 3))
    camp.add(new THREE.Points(sparks, points({ color: '#FFC56A', size: 0.2, fog: false, blending: THREE.AdditiveBlending })))
  }
  camp.position.set(x, height(x, z), z)
  scene.add(camp)
}

/// 宝箱：我的 App 藏在林子里的样子。金色的锁扣会反一点光，远远能瞄见
function chest(scene, x, z, turn) {
  const box = new THREE.Group()
  box.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.75), mat('#8A5A3A')), 0, 0.275, 0)))
  box.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.3, 0.81), mat('#9F6C46')), 0, 0.7, 0)))
  const gold = new THREE.MeshStandardMaterial({ color: '#E8B93E', emissive: '#C98F1E', emissiveIntensity: night ? 0.9 : 0.25, roughness: 0.4, metalness: 0.3 })
  for (const gx of [-0.36, 0.36]) box.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.84), gold), gx, 0.44, 0))
  box.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.1), gold), 0, 0.5, 0.42))
  box.position.set(x, height(x, z), z)
  box.rotation.y = turn
  scene.add(box)
  return box
}

function chen(scene, x, z, turn) {
  const body = new THREE.Group()
  const soft = color => new THREE.MeshStandardMaterial({ color, roughness: 1 })
  body.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 6, 12), soft('#E0A63A')), 0, 0.98, 0)))
  body.add(shade(at(new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), soft('#F7D9BF')), 0, 1.86, 0)))
  body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), soft('#232323')), 0, 1.9, -0.03))
  for (const side of [-0.17, 0.17]) body.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.32, 4, 8), soft('#3D4A5C')), side, 0.3, 0)))
  body.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.26), soft('#3F6B55')), 0, 1.02, -0.36))
  body.position.set(x, height(x, z), z)
  body.rotation.y = turn
  scene.add(body)
}

/// 季节里飘着的东西：花瓣、落叶、雪、雨、萤火虫，还有夜里的星星和流星
const dot = (() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const context = canvas.getContext('2d'); const fill = context.createRadialGradient(16, 16, 0, 16, 16, 16); fill.addColorStop(0, 'rgba(255,255,255,1)'); fill.addColorStop(0.55, 'rgba(255,255,255,.9)'); fill.addColorStop(1, 'rgba(255,255,255,0)'); context.fillStyle = fill; context.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(canvas) })()
const points = options => new THREE.PointsMaterial({ map: dot, transparent: true, depthWrite: false, ...options })

function air(scene) {
  const cloud = (count, make, material) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: count }, make).flat()), 3))
    scene.add(new THREE.Points(geometry, material))
  }
  const drift = () => [between(-34, 34), between(0.2, 13), between(-30, 26)]
  if (weather === 'rain') {
    const lines = Array.from({ length: 520 }, () => { const [x, y, z] = [between(-42, 42), between(0, 24), between(-36, 30)]; return [x, y, z, x - 0.25, y + 1.2, z] }).flat()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
    scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: night ? '#9FB6C8' : '#FFFFFF', transparent: true, opacity: 0.6 })))
  }
  if (season === 'winter' || weather === 'snow') cloud(700, () => [between(-44, 44), between(0, 22), between(-40, 30)], points({ color: '#FFFFFF', size: 0.34, opacity: 0.95 }))
  if (season === 'spring') cloud(110, drift, points({ color: '#F9B4CA', size: 0.36 }))
  if (season === 'autumn') cloud(90, drift, points({ color: '#E98A34', size: 0.42 }))
  if (season === 'summer' && night) cloud(46, () => [between(-24, 24), between(0.6, 3.6), between(-18, 14)], points({ color: '#E4F26A', size: 0.5, fog: false, blending: THREE.AdditiveBlending }))
  if (!night) return
  cloud(420, () => { const a = random() * 6.28; const up = between(0.12, 1.2); return [Math.cos(a) * Math.cos(up) * 170, Math.sin(up) * 170, Math.sin(a) * Math.cos(up) * 170 - 20] }, new THREE.PointsMaterial({ color: '#FFFFFF', size: 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }))
  if (weather !== 'meteor') return
  for (const [x, y, long] of [[-34, 62, 15], [22, 70, 10], [48, 52, 8]]) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x, y, -120, x + long, y + long * 0.45, -120]), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0.1, 0.15, 0.25]), 3))
    scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, linewidth: 2 })))
  }
}

function lights(scene) {
  const haze = new THREE.Color(sky[1])
  scene.fog = new THREE.Fog(haze, night ? 26 : 34, night ? 96 : 118)
  const sun = new THREE.DirectionalLight(night ? '#9DB7E0' : look.sun, night ? 0.55 : 2.5)
  sun.position.set(-28, 42, 22)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 5, far: 130 })
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.04
  scene.add(sun, new THREE.HemisphereLight(night ? '#33507A' : sky[0], night ? '#0E1A1C' : look.ground[0], night ? 0.9 : 1.55))
}

function tags(camera, list) {
  const root = document.getElementById('tags')
  for (const [badge, text, x, y, z, gold] of list) {
    const spot = new THREE.Vector3(x, y, z).project(camera)
    const node = document.createElement('div')
    node.className = `tag${gold ? ' gold' : ''}`
    node.innerHTML = `<b>${badge}</b>${text}`
    node.style.transform = `translate(-50%, -100%) translate(${(spot.x + 1) / 2 * innerWidth}px, ${(1 - spot.y) / 2 * innerHeight}px)`
    root.append(node)
  }
}

function chrome() {
  const names = { spring: '春', summer: '夏', autumn: '秋', winter: '冬', day: '白天', night: '夜晚', clear: '晴', rain: '雨', snow: '雪', meteor: '流星' }
  const time = night ? 'night' : 'day'
  const link = (values, key, current) => values.map(value => `<a class="${value === current ? 'on' : ''}" href="?${new URLSearchParams({ season, time, weather, [key]: value })}">${names[value]}</a>`).join('')
  document.getElementById('seasons').innerHTML = link(['spring', 'summer', 'autumn', 'winter'], 'season', season)
  document.getElementById('times').innerHTML = link(['day', 'night'], 'time', time)
  document.getElementById('weathers').innerHTML = link(['clear', 'rain', 'snow', 'meteor'], 'weather', weather)
  document.getElementById('where').textContent = `${names[season]} · ${names[time]}${weather === 'clear' ? '' : ' · ' + names[weather]}`
  const bed = { spring: night ? '蛙鸣' : '晨鸟 · 溪水', summer: night ? '蟋蟀 · 蛙鸣' : '蝉 · 溪水', autumn: '林间的风', winter: '冬天的风' }[season]
  document.getElementById('sounds').textContent = [weather === 'rain' ? '雨打树叶' : bed, night ? '篝火' : ''].filter(Boolean).join(' · ')
  document.body.style.setProperty('--sky-top', sky[0])
  document.body.style.setProperty('--sky-low', sky[1])
}

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight, false)
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = night ? 1.25 : 1.05
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 400)
camera.position.set(3, 13.5, 33)
camera.lookAt(0, 2.6, -2)
lights(scene)
ground(scene)
forest(scene)
cabin(scene, -11, -7, 0.62, { lit: true })
cabin(scene, 12, -9, -0.5, { wide: 6.4, tall: 3.3, lit: true, wall: '#B48A62', roof: '#7A4B3E' })
campfire(scene, 0, 4)
chest(scene, 7, 9.4, -0.5)
litter(scene)
chen(scene, -1.6, 7.6, 2.6)
air(scene)
chrome()
camera.updateMatrixWorld()
tags(camera, [['1', '日常生活', -11, height(-11, -7) + 6.6, -7], ['词', '单词屋', 12, height(12, -9) + 7.2, -9], ['?', '一只宝箱', 7, height(7, 9.4) + 1.9, 9.4, true]])
renderer.render(scene, camera)
window.forestReady = true
