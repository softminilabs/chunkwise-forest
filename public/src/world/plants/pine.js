import * as THREE from 'three'
import { at, leafGeometry, mat, seeded, shade } from '../../look.js'

// 顶点色管一块东西里的明暗（枝梢亮、根上暗），实例色管这一根的深浅，所以整棵树一份材质就够
const PAINT = mat('#ffffff', { vertexColors: true })
// 种翅和种壳是薄片，背面也要看得见
const SHEET = mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide })
const FLAT = mat('#ffffff')
// 从树顶到底层：越往下越深。照森林里夏天松树的 #2F7554 配的，屋里光暖，所以整体提亮了一点
const GREEN = { 4: ['#45966B', '#35825C', '#296C4D'], 3: ['#55A373', '#469463', '#3A8557'] }
// 枝梢上的新绿
const SHOOT = new THREE.Color('#86C46E')
const BARK = ['#6F4E3A', '#9A7352']
const SOIL = ['#5B4334', '#6E5341', '#4A372B']
// 三层树冠各占树冠高度的哪一段：[顶点, 底边, 底边半宽]，照「岁时」里那棵松树的剪影
const TIERS = [[0, 0.38, 0.48], [0.26, 0.68, 0.76], [0.54, 1, 1]]
// 一层里叠着的几片裙边：[上口半径, 上口高度, 下摆半径, 下摆高度, 比这一层的底色亮多少]，前四个都是这一层的几成。
// 主裙撑起这一层的轮廓；披在上面的几片浅，只比主裙鼓出一点点，鼓多了三层就看成了九层；
// 衬在下摆里头的那片深，从主裙的豁口里露出来
const MAIN = [0, 1, 1, 0, 0]
const LINING = [0.4, 0.42, 0.88, -0.04, -0.04]
const PIECES = { 3: [[0, 1.03, 0.66, 0.4, 0.035], MAIN], 4: [[0, 1.04, 0.53, 0.55, 0.045], [0, 1.02, 0.8, 0.27, 0.02], MAIN, LINING] }
// 每层每片裙边有几根枝，从树顶那层数起
const LOBES = { 3: [[5, 7], [7, 10], [8, 12]], 4: [[5, 7, 9, 7], [7, 10, 13, 10], [8, 12, 16, 13]] }

const v = (x, y, z) => new THREE.Vector3(x, y, z)
const ring = (radius, angle, y) => v(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
const rgb = hex => new THREE.Color(hex).toArray()
const tint = new THREE.Color()
const dummy = new THREE.Object3D()

/// 按位置给每个顶点上色。colorAt(color, x, y, z, 第几个点) 把颜色写进 color 再还回来
function dye(geometry, colorAt) {
  const spot = geometry.attributes.position
  const color = new Float32Array(spot.count * 3)
  for (let i = 0; i < spot.count; i++) colorAt(tint, spot.getX(i), spot.getY(i), spot.getZ(i), i).toArray(color, i * 3)
  return geometry.setAttribute('color', new THREE.BufferAttribute(color, 3))
}

/// 把一串三角面拼成几何体，每个顶点带自己的颜色。corners：[[点, 颜色], ...]，三个一组
function facets(corners) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(([spot]) => spot.toArray()), 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(corners.flatMap(([, color]) => color), 3))
  geometry.computeVertexNormals()
  return geometry
}

/// 一把针：每根是一个细长的三棱锥。spikes：[[根, 尖, 多粗, 根上的颜色, 尖上的颜色]]
function needles(spikes) {
  const corners = []
  for (const [from, to, thick, low, high] of spikes) {
    const axis = to.clone().sub(from).normalize()
    const side = v(axis.y, axis.z, axis.x).cross(axis).normalize().multiplyScalar(thick)
    const base = [0, 1, 2].map(k => from.clone().add(side.clone().applyAxisAngle(axis, k * 2.094)))
    for (let k = 0; k < 3; k++) corners.push([base[k], low], [base[(k + 1) % 3], low], [to, high])
  }
  return facets(corners)
}

/// 同一个几何体画很多份。items：[{ matrix, color }]
function scatter(geometry, items, material = PAINT) {
  const mesh = shade(new THREE.InstancedMesh(geometry, material, items.length))
  items.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, tint.set(item.color ?? '#ffffff')) })
  return mesh
}

/// 一根干：根部张开成三道根脚，往上收细，中间歪一点，一圈圈有凹有凸；每个面深浅不一，像一块块树皮。colors：[根, 梢]
function stem(tall, thick, flare, colors, random, sides = 7) {
  const geometry = new THREE.CylinderGeometry(1, 1, tall, sides, 6).translate(0, tall / 2, 0).toNonIndexed()
  const spot = geometry.attributes.position
  const lean = [random.between(-1, 1), random.between(-1, 1)]
  const toes = random.next() * 6.28
  for (let i = 0; i < spot.count; i++) {
    const t = spot.getY(i) / tall
    const angle = Math.atan2(spot.getZ(i), spot.getX(i))
    const foot = flare * Math.pow(1 - t, 5)
    const wide = thick * (1 - 0.5 * t + foot * (1 + 0.5 * Math.cos(3 * angle + toes))) * (1 + 0.12 * Math.sin(2 * angle + 11 * t + toes))
    const bend = Math.sin(t * Math.PI) * thick * 0.6
    spot.setXYZ(i, spot.getX(i) * wide + lean[0] * bend, spot.getY(i), spot.getZ(i) * wide + lean[1] * bend)
  }
  const [low, high] = colors.map(color => new THREE.Color(color))
  const plates = Array.from({ length: spot.count / 3 }, () => random.between(0.86, 1.12))
  return shade(new THREE.Mesh(dye(geometry, (color, x, y, z, i) => color.lerpColors(low, high, y / tall).multiplyScalar(plates[Math.floor(i / 3)])), PAINT))
}

/// 翻起来的土：几粒小土块围在根边上，离中心 near 到 far 那么远
function clumps(random, count, near, far, size) {
  const items = Array.from({ length: count }, (_, i) => {
    const spot = ring(random.between(near, far), (i + random.next()) / count * 6.28, size * 0.2)
    dummy.position.copy(spot)
    dummy.rotation.set(random.next() * 3, random.next() * 3, random.next() * 3)
    dummy.scale.set(size * random.between(0.7, 1.3), size * random.between(0.5, 0.8), size * random.between(0.7, 1.3))
    dummy.updateMatrix()
    return { matrix: dummy.matrix.clone(), color: random.pick(SOIL) }
  })
  return scatter(new THREE.IcosahedronGeometry(1, 0), items, FLAT)
}

/// 一片裙边：从上口往下撒开的一圈枝。枝背是脊、枝和枝之间是沟，越往下沟越深，脊长沟短，下摆就剪成了一个个垂着的梢头。
/// top、hem：[半径, 高度]。面都推进 corners，返回下摆上每个豁口的位置
function skirt(corners, [topWide, topY], [hemWide, hemY], lobes, color, random) {
  const base = new THREE.Color(color)
  const under = base.clone().multiplyScalar(0.6).toArray()
  const columns = Array.from({ length: lobes * 2 }, (_, c) => {
    const ridge = c % 2 === 0
    const angle = (c + random.between(-0.25, 0.25)) / lobes * Math.PI
    const end = ridge ? random.between(0.94, 1.04) : random.between(0.82, 0.9)
    // 梢头多数往下垂，少数往外翘，下摆才参差
    const lift = ridge ? random.between(-0.07, 0.07) : 0
    return [0, 0.3, 0.56, 0.8, 1].map((s, j) => {
      const t = s * end
      // 中间几圈的点各自歪一点，面才不是一条条从顶拉到底的长片
      const wobble = j && j < 4 ? random.between(-0.2, 0.2) / lobes : 0
      const radius = (topWide + (hemWide - topWide) * t) * (ridge ? 1 : 1 - 0.16 * Math.pow(s, 1.5)) * (1 + (j === 4 ? 0.8 * lift : wobble))
      const tone = base.clone().multiplyScalar((ridge ? 0.76 : 0.68) + 0.24 * s)
      if (ridge && j === 4) tone.lerp(SHOOT, 0.7)
      return { spot: ring(radius, angle + wobble, topY + (hemY - topY) * (t - (j === 4 ? lift : 0))), tone: tone.toArray() }
    })
  })
  const centre = v(0, hemY + (topY - hemY) * 0.45, 0)
  const face = (...three) => { const k = random.between(0.92, 1.08); for (const { spot, tone } of three) corners.push([spot, tone.map(x => x * k)]) }
  columns.forEach((a, c) => {
    const b = columns[(c + 1) % columns.length]
    // 四边形的对角线总是从脊上往沟里折，脊两边才对称
    for (let j = 0; j < 4; j++) {
      if (j || topWide) face(a[j], b[j], c % 2 ? a[j + 1] : b[j + 1])
      face(c % 2 ? b[j] : a[j], b[j + 1], a[j + 1])
    }
    corners.push([a[4].spot, under], [b[4].spot, under], [centre, under])
  })
  return columns.filter((_, c) => c % 2).map(column => column[4].spot)
}

/// 一层树冠：几片裙边叠着。原点在这一层底边的正中
function tier(tall, wide, pieces, lobes, color, random) {
  const corners = []
  const nooks = pieces.map(([topWide, topY, hemWide, hemY, lighter], k) =>
    skirt(corners, [topWide * wide, topY * tall], [hemWide * wide, hemY * tall], lobes[k], tint.set(color).offsetHSL(0, 0, lighter).getHex(), random))
  const mesh = shade(new THREE.Mesh(facets(corners), PAINT))
  mesh.userData.nooks = nooks[pieces.indexOf(MAIN)]
  return mesh
}

/// 松果：挂点在原点，往下垂。隔一圈拧半格、鼓出来一点，面就成了一片片错开的鳞，鳞尖亮、缝里暗
function coneGeometry() {
  const profile = [[0, -0.076], [0.013, -0.068], [0.02, -0.055], [0.03, -0.042], [0.026, -0.03], [0.029, -0.018], [0.016, -0.007], [0, 0]]
  const geometry = new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), 7)
  const spot = geometry.attributes.position
  const [dark, light] = [new THREE.Color('#60402C'), new THREE.Color('#B98A5A')]
  const scale = i => i % profile.length % 2 === 1
  for (let i = 0; i < spot.count; i++) if (scale(i)) spot.setXYZ(i, ...v(spot.getX(i), spot.getY(i), spot.getZ(i)).applyAxisAngle(v(0, 1, 0), Math.PI / 7).toArray())
  return dye(geometry, (color, x, y, z, i) => color.copy(scale(i) ? light : dark))
}

/// 在这一层下摆的豁口里挂几颗松果：两边有枝夹着，才像是长在枝下，不像挂上去的
function hang(layer, count, random) {
  const { nooks } = layer.userData
  const items = Array.from({ length: count }, (_, i) => {
    const nook = nooks[Math.floor((i + 0.5) * nooks.length / count)]
    dummy.position.set(nook.x * 1.03, nook.y - 0.018, nook.z * 1.03)
    dummy.rotation.set(random.between(-0.2, 0.2), random.next() * 6.28, random.between(-0.2, 0.2))
    dummy.scale.setScalar(random.between(0.95, 1.2))
    dummy.updateMatrix()
    return { matrix: dummy.matrix.clone(), color: tint.set('#ffffff').offsetHSL(0, 0, random.between(-0.12, 0)).getHex() }
  })
  layer.add(scatter(coneGeometry(), items))
}

/// 小树和长成：短树干 + 三层树冠 + 树顶一支新梢
function tree(stage) {
  const full = stage === 4
  const random = seeded(full ? 47 : 23)
  const tall = full ? 1.45 : 0.95
  const reach = full ? 0.47 : 0.315
  const crown = tall * 0.87
  const group = new THREE.Group()
  // 顶上那层矮一截，把树尖让给新梢
  const layers = TIERS.map(([top, bottom, wide], k) => at(tier((bottom - top) * crown * (k ? 1 : 0.86), wide * reach, PIECES[stage], LOBES[stage][k], GREEN[stage][k], random), 0, tall - bottom * crown, 0))
  const peak = TIERS[0][1] * crown
  const [low, high] = [GREEN[stage][0], '#8CCB7A'].map(rgb)
  const spikes = [[v(0, peak * 0.7, 0), v(0, peak, 0), full ? 0.02 : 0.015, low, high]]
  for (let i = 0; i < (full ? 5 : 0); i++) spikes.push([v(0, peak * 0.82, 0), ring(0.05, i * 1.257 + 0.4, peak * 0.82 + random.between(0.03, 0.05)), 0.008, low, high])
  layers[0].add(shade(new THREE.Mesh(needles(spikes), PAINT)))
  if (full) { hang(layers[1], 4, random); hang(layers[2], 6, random) }
  // 正式花盆的土面往边上是塌下去的，根脚埋深一点才不会悬空
  group.add(at(stem(tall * 0.7, full ? 0.062 : 0.04, 1.2, BARK, random), 0, -0.02, 0), ...layers, clumps(random, full ? 7 : 5, 0.1, 0.18, 0.02))
  group.userData.sway = layers.map((node, k) => ({ node, lag: k * 0.8, reach: 0.022 - k * 0.006 }))
  return group
}

/// 小苗的一根枝：一截细梗，从头到尾长满往前翘的针，像个瓶刷。沿 +y 长 1，往 -x 那边弯：摆的时候让 -x 朝上，枝梢就翘起来了
function brushGeometry(random) {
  const curve = s => v(-0.2 * s * s, s, 0)
  const [twig, low, high] = ['#6E6A45', '#3F8F5E', '#8ACB78'].map(rgb)
  const spikes = [[curve(0), curve(0.95), 0.04, twig, low]]
  for (let i = 0; i < 26; i++) {
    const s = 0.12 + 0.88 * i / 25
    // 越靠梢头的针越贴着枝往前长，梢头收成一个尖
    const tilt = random.between(0.55, 0.9) * (1.15 - 0.75 * s)
    const out = v(Math.sin(tilt) * Math.cos(i * 2.4) - 0.4 * s, Math.cos(tilt), Math.sin(tilt) * Math.sin(i * 2.4)).normalize()
    spikes.push([curve(s), curve(s).addScaledVector(out, random.between(0.38, 0.52)), 0.036, low, high])
  }
  return needles(spikes)
}

/// 小苗：一根细干，三轮往上翘的针叶簇，顶上一支直着长的新梢
function sapling() {
  const random = seeded(19)
  const group = new THREE.Group()
  const brush = brushGeometry(random)
  const whorls = [[0.1, 0.15, 1.15, 5], [0.2, 0.125, 1.0, 5], [0.29, 0.095, 0.8, 4], [0.34, 0.11, 0, 1]].map(([y, long, tilt, count]) => {
    const turn = random.next() * 6.28
    const items = Array.from({ length: count }, (_, i) => {
      dummy.position.set(0, 0, 0)
      dummy.rotation.set(0, turn + (i + random.between(-0.15, 0.15)) / count * 6.28, -tilt - random.between(-0.08, 0.08))
      dummy.scale.setScalar(long * random.between(0.9, 1.08))
      dummy.updateMatrix()
      return { matrix: dummy.matrix.clone(), color: tint.set('#ffffff').offsetHSL(0, 0, random.between(-0.08, 0)).getHex() }
    })
    return at(scatter(brush, items), 0, y, 0)
  })
  group.add(at(stem(0.36, 0.012, 1.2, ['#6B4E3A', '#74804F'], random, 6), 0, -0.005, 0), ...whorls, clumps(random, 5, 0.04, 0.1, 0.016))
  group.userData.sway = whorls.map((node, k) => ({ node, lag: k * 0.9, reach: 0.03 }))
  return group
}

/// 芽：一根细茎顶着一圈撑开的细针，针尖上还顶着半片种壳
function sprout() {
  const random = seeded(11)
  const group = new THREE.Group()
  const [low, high] = ['#58A264', '#A9D888'].map(rgb)
  const spikes = []
  for (let i = 0; i < 9; i++) {
    const tilt = random.between(0.7, 0.95)
    spikes.push([v(0, 0, 0), ring(Math.sin(tilt) * 0.078, i / 9 * 6.28 + random.between(-0.15, 0.15), Math.cos(tilt) * 0.078), 0.005, low, high])
  }
  for (let i = 0; i < 4; i++) spikes.push([v(0, 0, 0), ring(0.012, i * 1.7, random.between(0.03, 0.042)), 0.004, high, high])
  const head = at(shade(new THREE.Mesh(needles(spikes), PAINT)), 0, 0.115, 0)
  const [dark, pale] = [new THREE.Color('#6B4630'), new THREE.Color('#A87850')]
  const husk = shade(new THREE.Mesh(dye(new THREE.SphereGeometry(0.02, 6, 3, 0, 6.283, 0, 1.75).scale(0.85, 1.45, 0.7), (color, x, y) => color.lerpColors(dark, pale, y / 0.03)), SHEET))
  husk.position.copy(spikes[1][1]).multiplyScalar(0.9)
  husk.rotation.set(0.5, 0.3, -0.7)
  head.add(husk)
  group.add(at(stem(0.115, 0.0065, 0.9, ['#C9917E', '#86BD6C'], random, 5), 0, -0.003, 0), head, clumps(random, 5, 0.022, 0.06, 0.011))
  group.userData.sway = [{ node: head, lag: 0, reach: 0.05 }]
  return group
}

/// 种子：一粒带翅的松子半埋在土里，底下一小堆翻起的土
function seed() {
  const random = seeded(7)
  const group = new THREE.Group()
  const [dark, pale, wingLow, wingHigh, heapLow, heapHigh] = ['#5E3D28', '#A0714A', '#B38A5E', '#EAD6AE', SOIL[2], SOIL[1]].map(color => new THREE.Color(color))
  // 松子一头圆一头尖：尖的那头扎在土里，圆的那头连着翅
  const drop = [[0, -0.047], [0.012, -0.034], [0.022, -0.012], [0.024, 0.01], [0.016, 0.034], [0, 0.045]].map(([radius, y]) => new THREE.Vector2(radius, y))
  const nut = shade(new THREE.Mesh(dye(new THREE.LatheGeometry(drop, 7).scale(1, 1, 0.8), (color, x, y) => color.lerpColors(dark, pale, y / 0.094 + 0.5)), PAINT))
  nut.rotation.set(0.25, 0, -0.8)
  // 沿中脉折一下，两半片各吃各的光，才看得出是一片薄翅不是一张纸
  const blade = leafGeometry(0.085)
  for (let i = 0; i < blade.attributes.position.count; i++) blade.attributes.position.setZ(i, Math.abs(blade.attributes.position.getY(i)) * 0.45)
  const wing = shade(new THREE.Mesh(dye(blade, (color, x) => color.lerpColors(wingLow, wingHigh, x / 0.085 + 0.5)), SHEET))
  wing.rotation.set(-0.7, 0.2, 0.5)
  const heap = shade(new THREE.Mesh(dye(new THREE.IcosahedronGeometry(0.078, 1).scale(1, 0.3, 0.86), (color, x, y) => color.lerpColors(heapLow, heapHigh, y / 0.024)), PAINT))
  group.add(heap, at(nut, -0.014, 0.02, 0), at(wing, 0.052, 0.05, 0.004), clumps(random, 9, 0.045, 0.1, 0.015))
  return group
}

export const pine = {
  id: 'pine',
  drops: 30,
  /// stage：0 种子、1 芽、2 小苗、3 小树、4 长成。返回这个样子的植物：THREE.Group，原点在土面正中，y 向上，单位是米。每次调用都新建一棵
  build(stage) { return [seed, sprout, sapling, tree, tree][stage](stage) },
  /// 每帧调一次，让它轻轻动一动（针叶微微晃）。group 是 build 返回的那个。可以很轻，但要便宜
  sway(group, time) {
    for (const { node, lag, reach } of group.userData.sway ?? []) node.rotation.set(Math.sin(time * 1.1 + lag) * reach, node.rotation.y, Math.cos(time * 0.9 + lag * 1.7) * reach)
  },
}
