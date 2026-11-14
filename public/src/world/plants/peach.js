import * as THREE from 'three'
import { mat, seeded, shade } from '../../look.js'

// 颜色都写在顶点和实例上，材质只要三份：实心的（枝干、桃核、土）、粉的薄片（花瓣、花蕊、花苞）、绿的薄片（叶）。
// 花瓣和嫩叶是透光的：背光的那几片自己带一点亮，不然屋里地板反上来的光会把粉色、嫩绿染成土色
const SOLID = mat('#ffffff', { vertexColors: true })
const PETAL = mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide, emissive: '#F5BBCD', emissiveIntensity: 0.1 })
const LEAF = mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide, emissive: '#A6D788', emissiveIntensity: 0.08 })
const tone = hex => new THREE.Color(hex)
const vec = ([x, y, z]) => new THREE.Vector3(x, y, z)
const PINK = ['#F5BBCD', '#FAD7E2', '#EE9DB8'].map(tone)
const BUD = ['#E8779E', '#DE6390'].map(tone)
const GREEN = ['#BFE39B', '#A6D788', '#8FCB74'].map(tone)
const WHITE = tone('#ffffff')
// 老干颜色深，越细的枝越红：桃树当年的新梢是红褐色的
const BARK = ['#6A4B3A', '#7A4F3F', '#93604F', '#93604F'].map(tone)
const SHOOT = tone('#A6D788'), PALE = tone('#DDE8B8'), STALK = tone('#8C7A52'), COTYLEDON = tone('#93C56D')
const PIT = tone('#B98554'), PIT_DARK = tone('#5E3B25'), SOIL = ['#6F523F', '#4E3A2D'].map(tone)
const X = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1)
const spot = new THREE.Vector3(), tint = new THREE.Color(), basis = new THREE.Matrix4(), turn = new THREE.Quaternion(), twist = new THREE.Quaternion()

function geometryOf({ position, color, index }) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  geometry.setIndex(index)
  // 平涂用不着法线，可接影子时的偏移要用，没有的话影子会花
  geometry.computeVertexNormals()
  return geometry
}

// 下面四样薄片都是：根在原点、朝 +y 长、正面朝 +z，一个单位长

/// 一片花瓣：略微内扣的小圆片，根上窄，五片之间才看得出缝。根上颜色深，拼起来花心往外晕开；
/// 一边比另一边高一点，五片才是一片压一片
function petalGeometry() {
  const rim = [[-0.26, 0.3], [-0.43, 0.66], [-0.23, 0.97], [0.23, 0.97], [0.43, 0.66], [0.26, 0.3]]
  const position = [0, 0, 0], color = [0.84, 0.44, 0.58], index = []
  rim.forEach(([x, y], k) => {
    position.push(x, y, 0.5 * x * x + 0.2 * y * y + 0.1 * x)
    color.push(1, 1, 1)
    if (k) index.push(0, k + 1, k)
  })
  return geometryOf({ position, color, index })
}

/// 花心：五根花蕊，从花瓣的缝里往外翘，根上发白、尖上是黄的
function heartGeometry() {
  const position = [], color = [], index = []
  for (let k = 0; k < 5; k++) {
    const a = (k + 0.5) / 5 * Math.PI * 2
    position.push(Math.cos(a - 0.9) * 0.09, Math.sin(a - 0.9) * 0.09, 0.05, Math.cos(a + 0.9) * 0.09, Math.sin(a + 0.9) * 0.09, 0.05, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0.34)
    color.push(1, 0.84, 0.6, 1, 0.84, 0.6, 1, 0.68, 0.12)
    index.push(k * 3, k * 3 + 1, k * 3 + 2)
  }
  return geometryOf({ position, color, index })
}

/// 花苞：鼓肚子、尖头的小卵形，下面三成裹着深色的花萼
function budGeometry() {
  const position = [0, 0, 0, 0, 1, 0], color = [0.45, 0.3, 0.26, 1, 1, 1], index = []
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2, next = (k + 1) % 5 * 2
    position.push(Math.cos(a) * 0.22, 0.22, Math.sin(a) * 0.22, Math.cos(a + 0.63) * 0.31, 0.52, Math.sin(a + 0.63) * 0.31)
    color.push(0.5, 0.33, 0.3, 1, 1, 1)
    index.push(0, 2 + k * 2, 2 + next, 2 + k * 2, 3 + k * 2, 2 + next, 2 + next, 3 + k * 2, 3 + next, 1, 3 + next, 3 + k * 2)
  }
  return geometryOf({ position, color, index })
}

/// 桃叶：细长的披针形。沿中脉折一道，叶尖往下垂，光一照两半一明一暗
function bladeGeometry() {
  const position = [0, 0, 0, 0, 0.3, 0.015, 0, 0.66, -0.04, 0, 1, -0.17]
  for (const side of [-1, 1]) position.push(side * 0.15, 0.3, 0.08, side * 0.135, 0.64, 0.025)
  const index = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 3, 5, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 3]
  return geometryOf({ position, color: position.map(() => 1), index })
}

const SHAPES = { petal: [petalGeometry, PETAL], heart: [heartGeometry, PETAL], bud: [budGeometry, PETAL], leaf: [bladeGeometry, LEAF] }
/// 一堆还没变成网格的料：solid 是实心那部分（枝干、桃核、土）的顶点，其余四样是一片一片的 [矩阵, 颜色]
const fresh = look => ({ ...look, solid: { position: [], color: [], index: [] }, petal: [], heart: [], bud: [], leaf: [] })

/// 把攒下的料变成网格。pivot：这一枝晃的时候绕着哪一点转。cast：投不投影子
function finish(part, pivot = new THREE.Vector3(), cast = true) {
  const group = new THREE.Group()
  if (part.solid.index.length) group.add(shade(new THREE.Mesh(geometryOf(part.solid), SOLID)))
  for (const kind in SHAPES) {
    if (!part[kind].length) continue
    const mesh = shade(new THREE.InstancedMesh(SHAPES[kind][0](), SHAPES[kind][1], part[kind].length))
    mesh.castShadow = cast
    part[kind].forEach(([matrix, color], k) => { mesh.setMatrixAt(k, matrix); mesh.setColorAt(k, color) })
    group.add(mesh)
  }
  // 料都是照整棵树的坐标摆的：组挪到支点上，里面的网格再挪回来
  group.position.copy(pivot)
  for (const child of group.children) child.position.copy(pivot).negate()
  return group
}

/// 往 list 里放一片：根在 at，正面朝 normal，长的方向尽量朝 lead；再绕 normal 转 spin、从面上掀起 tilt
function put(list, at, normal, lead, spin, tilt, size, color) {
  const side = new THREE.Vector3().crossVectors(lead, normal).normalize()
  basis.makeBasis(side, new THREE.Vector3().crossVectors(normal, side), normal)
  turn.setFromRotationMatrix(basis).multiply(twist.setFromAxisAngle(Z, spin)).multiply(twist.setFromAxisAngle(X, tilt))
  list.push([new THREE.Matrix4().compose(at, turn, new THREE.Vector3(size, size, size)), color])
}
// 给 put 挑一个不会和 normal 平行的 lead
const aside = normal => Math.abs(normal.y) < 0.9 ? UP : X

/// 往 solid 里添一根沿曲线走的管子，radius(t) 是一路的粗细，每隔 step 一圈，梢上收尖。
/// 一圈一圈错开半格：面是三角的碎面，不像一根车出来的棍子
function limb(solid, points, radius, sides, step, from = BARK[0], to = from) {
  const curve = new THREE.CatmullRomCurve3(points)
  const rings = Math.max(2, Math.round(curve.getLength() / step))
  const frames = curve.computeFrenetFrames(rings)
  const first = solid.position.length / 3
  for (let i = 0; i <= rings; i++) {
    const center = curve.getPointAt(i / rings)
    for (let k = 0; k < sides; k++) {
      const around = (k + i % 2 / 2) / sides * Math.PI * 2
      // 粗细和深浅都再抖一点，老干才有疙疙瘩瘩、斑斑驳驳的样子
      const reach = radius(i / rings) * (1 + 0.1 * Math.sin(i * 2.7 + k * 1.9))
      spot.copy(center).addScaledVector(frames.normals[i], Math.cos(around) * reach).addScaledVector(frames.binormals[i], Math.sin(around) * reach)
      tint.lerpColors(from, to, i / rings).multiplyScalar(1 + 0.09 * Math.sin(i * 5.1 + k * 3.3))
      solid.position.push(spot.x, spot.y, spot.z)
      solid.color.push(tint.r, tint.g, tint.b)
      if (!i) continue
      const a = first + (i - 1) * sides + k, b = first + (i - 1) * sides + (k + 1) % sides, c = a + sides, d = b + sides
      solid.index.push(...(i % 2 ? [a, b, c, b, d, c] : [a, b, d, a, d, c]))
    }
  }
  spot.copy(curve.getPointAt(1)).addScaledVector(curve.getTangentAt(1), radius(1) * 2)
  solid.position.push(spot.x, spot.y, spot.z)
  solid.color.push(to.r, to.g, to.b)
  const tip = first + (rings + 1) * sides
  for (let k = 0; k < sides; k++) solid.index.push(tip - sides + k, tip - sides + (k + 1) % sides, tip)
  return curve
}

/// 把一个现成的几何体并进 solid（桃核、土块、子叶）：自己带颜色就用自己的，不带就整个涂成 color
function lump(solid, geometry, color) {
  const first = solid.position.length / 3
  const { position, color: own } = geometry.attributes
  for (let i = 0; i < position.count; i++) {
    solid.position.push(position.getX(i), position.getY(i), position.getZ(i))
    own ? solid.color.push(own.getX(i), own.getY(i), own.getZ(i)) : solid.color.push(color.r, color.g, color.b)
    solid.index.push(first + i)
  }
  geometry.dispose()
}

/// 一小堆翻起来的土：(x, z) 周围 spread 以内散着 count 粒，越靠中间的越大（最大 big）
function crumbs(solid, random, count, x, z, spread, big) {
  for (let k = 0; k < count; k++) {
    const around = random.between(0, Math.PI * 2), away = random.between(0, 1) ** 0.7
    const size = big * (1 - 0.65 * away) * random.between(0.7, 1)
    lump(solid, new THREE.IcosahedronGeometry(size, 0).rotateX(around * 3).rotateZ(around * 5).scale(1, 0.7, 1).translate(x + Math.cos(around) * away * spread, size * 0.3, z + Math.sin(around) * away * spread), SOIL[k % 2])
  }
}

function flower(part, at, normal) {
  const { dice } = part
  const open = dice.next() < 0.82
  const size = open ? dice.between(0.05, 0.063) : dice.between(0.036, 0.044)
  const cup = open ? dice.between(0.3, 0.55) : dice.between(0.95, 1.2)
  const spin = dice.between(0, 6.28), color = dice.pick(PINK)
  for (let k = 0; k < 5; k++) put(part.petal, at, normal, aside(normal), spin + k * Math.PI * 0.4, cup + dice.between(-0.08, 0.08), size * dice.between(0.92, 1.06), color)
  put(part.heart, at, normal, aside(normal), spin, 0, size, WHITE)
}

/// 一片叶：从 at 朝 aim 伸出去，正面尽量朝天
function leaf(part, at, aim, long) {
  const lid = new THREE.Vector3(0.2, 1, 0.1).projectOnPlane(aim).normalize()
  put(part.leaf, at, lid, aim, 0, part.dice.between(-0.25, 0.25), long, part.dice.pick(GREEN))
}

/// 沿着一段枝摆花、花苞和叶，靠里 part.bare[level] 那一截留着不摆。part.bloom、part.budding：一个位置上开花、结苞的机会，
/// 剩下的长叶；part.quota.left：整棵树还能再开几朵
function dress(part, curve, level) {
  const { dice } = part, long = curve.getLength()
  // 最后一个节一定落在梢上：梢上光秃秃伸出去一截很难看
  for (let t = part.bare[level]; ; t = Math.min(1, t + dice.between(...part.gap) / long)) {
    const at = curve.getPointAt(t), along = curve.getTangentAt(t)
    const u = new THREE.Vector3().crossVectors(along, aside(along)).normalize(), v = new THREE.Vector3().crossVectors(along, u)
    let around = dice.between(0, 6.28)
    for (let n = dice.next() < 0.4 ? 2 : 1; n > 0; n--) {
      // 一个节上两朵的话，分在枝的两边
      around += dice.between(2.2, 4)
      const face = u.clone().multiplyScalar(Math.cos(around)).addScaledVector(v, Math.sin(around))
      // 花朝外、朝上开：从枝的这一边再往树冠外面和天上偏
      const normal = face.clone().addScaledVector(spot.set(at.x, 0, at.z).normalize(), 0.6).addScaledVector(UP, 0.7).normalize()
      const base = at.clone().addScaledVector(face, 0.012)
      const roll = dice.next()
      // 主枝的梢头最先开：小树只开两三朵，也要开在看得见的地方
      if ((roll < part.bloom || (t === 1 && !level && n === 1)) && part.quota.left-- > 0) flower(part, base, normal)
      else if (roll < part.bloom + part.budding) put(part.bud, base, normal, aside(normal), 0, Math.PI / 2, dice.between(0.04, 0.055), dice.pick(BUD))
      else leaf(part, base, face.addScaledVector(along, 0.8).addScaledVector(UP, 0.3).normalize(), part.leafLong * dice.between(0.8, 1.15))
    }
    if (t === 1) break
  }
}

/// 一根枝和它身上的小枝。level：0 主枝、1 侧枝、2 开花的细梢。
/// 枝怎么长用 random，花怎么摆用 part.dice：两串随机数分开，调花的疏密才不会把枝形也带变了
function grow(part, from, heading, long, girth, level, random) {
  const points = [from.clone()]
  const way = heading.clone()
  const joints = 4 - level
  for (let i = 0; i < joints; i++) {
    // 枝子是一折一折往外长的：每一节左右换着拐一下，再往上翘一点（越细的枝翘得越多）
    way.applyAxisAngle(UP, (i % 2 ? 0.4 : -0.4) * part.hand + random.between(-0.25, 0.25))
    way.y += i ? 0.1 + level * 0.07 : -0.05
    points.push(points[i].clone().addScaledVector(way.normalize(), long / joints))
  }
  const thick = t => girth * (1 - 0.66 * t)
  const curve = limb(part.solid, points, thick, 5 - level, 0.08 + level * 0.01, BARK[level], BARK[level + 1])
  dress(part, curve, level)
  if (level === 2) {
    // 梢上顶着一片刚展开的小叶
    leaf(part, points[joints], way.clone().add(spot.set(random.between(-0.5, 0.5), random.between(0, 0.6), random.between(-0.5, 0.5))).normalize(), part.leafLong * 0.8)
    return
  }
  part.forks[level].forEach((t, k) => {
    const side = (k % 2 ? 1 : -1) * part.hand
    const turned = curve.getTangentAt(t).applyAxisAngle(UP, side * random.between(0.75, 1.2))
    turned.y += 0.2
    grow(part, curve.getPointAt(t), turned.normalize(), long * (level ? 0.72 : 0.6 - 0.25 * t), thick(t) * 0.72, level + 1, random)
  })
}

// 树干怎么弯是摆好的：盆景的干讲究一弯一弯往上，主枝出在弯的外侧，细枝才交给随机数。
// boughs 里每根主枝：[出在树干多高（0..1）, 朝哪边（绕 y 的弧度）, 多长, 往上抬多少]，出在 1 的那根是接着树干往上的顶梢
const TREES = {
  3: {
    trunk: [[0.01, -0.02, 0], [-0.045, 0.12, 0.01], [0.035, 0.27, -0.01], [0, 0.43, 0.01]], girth: 0.034,
    boughs: [[0.5, 2.8, 0.34, 0.4], [0.72, -0.2, 0.32, 0.4], [1, 2.6, 0.26, 1.8], [0.88, 4.5, 0.26, 0.5]],
    look: { seed: 107, most: 3, bloom: 0, budding: 0.48, leafLong: 0.13, gap: [0.035, 0.06], bare: [0.4, 0.2, 0.05], forks: [[0.42, 0.72], [0.6]] },
  },
  4: {
    trunk: [[0.02, -0.03, 0], [-0.07, 0.15, 0.02], [-0.09, 0.31, 0], [0.04, 0.48, -0.03], [0.1, 0.64, 0], [0.04, 0.8, 0.03]], girth: 0.066,
    boughs: [[0.4, 2.95, 0.56, 0.4], [0.56, -0.3, 0.54, 0.4], [0.68, 4.2, 0.46, 0.5], [0.8, 1.75, 0.44, 0.5], [0.9, 0.5, 0.42, 0.6], [1, 2.4, 0.3, 1.5]],
    look: { seed: 124, most: Infinity, bloom: 0.86, budding: 0.08, leafLong: 0.06, gap: [0.064, 0.128], bare: [0.58, 0.36, 0.16], forks: [[0.3, 0.52, 0.74], [0.42, 0.78]] },
  },
}

function tree(stage) {
  const { trunk, girth, boughs, look } = TREES[stage]
  const random = seeded(stage * 97 + 5)
  const group = new THREE.Group()
  const stock = fresh()
  // 根脚往外撇开，上去很快收细
  const thick = t => girth * (1 - 0.6 * t + 0.6 * Math.exp(-t * 16))
  const spine = limb(stock.solid, trunk.map(vec), thick, 7, 0.06)
  for (const around of [0.5, 2.2, 3.6, 5.3]) {
    const out = new THREE.Vector3(Math.cos(around), 0, Math.sin(around))
    limb(stock.solid, [[girth * 0.6, 0.04], [girth * 1.9, 0.016], [girth * 3, -0.012]].map(([away, y]) => out.clone().multiplyScalar(away).setY(y)), t => girth * (0.42 - 0.3 * t), 4, 0.05)
  }
  // 土面上落的几片花瓣。太小，只接影不投影；花盆里的土中间鼓、边上低，离盆心越远放得越低
  if (stage === 4) for (let k = 0; k < 7; k++) {
    const around = random.between(0, Math.PI * 2), away = random.between(0.09, 0.21)
    put(stock.petal, new THREE.Vector3(Math.cos(around) * away, 0.006 - 0.15 * away * away, Math.sin(around) * away), UP, X, around * 5, random.between(-0.1, 0.1), 0.05, PINK[k % 3])
  }
  group.add(finish(stock, undefined, false))
  const quota = { left: look.most }
  group.userData.boughs = boughs.map(([t, around, long, rise], k) => {
    const part = fresh({ ...look, quota, hand: k % 2 ? 1 : -1, dice: seeded(look.seed + k) })
    const from = spine.getPointAt(t)
    grow(part, from, new THREE.Vector3(Math.cos(around), rise, Math.sin(around)).normalize(), long, thick(t) * (t < 1 ? 0.62 : 1), 0, random)
    const bough = finish(part, from)
    group.add(bough)
    return bough
  })
  return group
}

/// 桃核：一头尖的扁杏仁形，表面是一道道顺着长的深沟（沟里颜色深），合缝那一圈鼓起一道棱
function pitGeometry(long) {
  const geometry = new THREE.IcosahedronGeometry(1, 2)
  const position = geometry.attributes.position, color = []
  for (let i = 0; i < position.count; i++) {
    spot.fromBufferAttribute(position, i)
    const groove = Math.sin(Math.atan2(spot.z, spot.x) * 5 + 1.6 * Math.sin(spot.y * 4)) * (1 - spot.y * spot.y)
    // 上半截收成尖，下半截是圆的
    const waist = (spot.y > 0 ? 1 - 0.6 * spot.y ** 1.3 : 1 - 0.1 * spot.y * spot.y) * (1 + 0.13 * groove)
    const seam = 1 + 0.14 * Math.exp(-((spot.z / 0.22) ** 2))
    position.setXYZ(i, spot.x * 0.66 * waist * seam, spot.y * (1 + 0.25 * Math.max(0, spot.y)), spot.z * 0.42 * waist)
    tint.lerpColors(PIT_DARK, PIT, 0.5 + 0.5 * groove)
    color.push(tint.r, tint.g, tint.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  return geometry.scale(long / 2, long / 2, long / 2)
}

function seed() {
  const random = seeded(3)
  const part = fresh()
  // 尖朝上斜插着，露出大半个，宽的那一面朝着屋里
  lump(part.solid, pitGeometry(0.106).rotateZ(0.5).rotateX(-0.3).rotateY(0.35).translate(-0.025, 0.018, 0.012))
  crumbs(part.solid, random, 9, -0.025, 0.012, 0.07, 0.012)
  // 旁边一小撮翻起的土：底下一个矮土包，上面堆着大大小小的土块
  lump(part.solid, new THREE.IcosahedronGeometry(1, 1).scale(0.042, 0.014, 0.036).translate(0.062, 0, -0.025), SOIL[1])
  crumbs(part.solid, random, 11, 0.062, -0.025, 0.042, 0.024)
  return finish(part)
}

function sprout() {
  const random = seeded(7)
  const group = new THREE.Group()
  const soil = fresh(), body = fresh({ dice: random })
  const stem = limb(body.solid, [[0, -0.01, 0], [0.011, 0.04, 0.003], [0.005, 0.09, 0], [-0.008, 0.135, -0.002]].map(vec), t => 0.0085 - 0.0025 * t, 5, 0.02, PALE, SHOOT)
  const top = stem.getPointAt(1)
  for (const side of [-1, 1]) {
    // 子叶是桃仁撑开变的，比真叶圆、比真叶厚
    lump(body.solid, new THREE.IcosahedronGeometry(1, 1).scale(0.03, 0.008, 0.036).translate(0, 0, 0.036).rotateX(-0.45).rotateY(side * Math.PI / 2 + 0.3).translate(top.x, top.y - 0.004, top.z), COTYLEDON)
    leaf(body, top, new THREE.Vector3(side * 0.35, 1, side * 0.5).normalize(), 0.045)
  }
  crumbs(soil.solid, random, 8, 0, 0, 0.06, 0.012)
  const plant = finish(body)
  group.add(finish(soil), plant)
  group.userData.boughs = [plant]
  return group
}

function seedling() {
  const random = seeded(11)
  const group = new THREE.Group()
  const soil = fresh(), body = fresh({ dice: random })
  const stem = limb(body.solid, [[0, -0.01, 0], [0.02, 0.1, 0.008], [0.012, 0.2, -0.004], [-0.012, 0.3, 0.004], [0, 0.39, 0]].map(vec), t => 0.01 - 0.006 * t, 5, 0.03, STALK, SHOOT)
  for (let k = 0; k < 9; k++) {
    // 叶子绕着干一片一片错开长（每片转 137.5°），中间的最大；最顶上两片是刚抽出来的，小而直
    const t = Math.min(1, 0.2 + k * 0.12), around = k * 2.4 + 0.2
    const aim = new THREE.Vector3(Math.cos(around), k < 7 ? 0.4 + k * 0.1 : 2.2, Math.sin(around)).normalize()
    leaf(body, stem.getPointAt(t), aim, k < 7 ? 0.22 - Math.abs(k - 2.5) * 0.026 : 0.07)
  }
  crumbs(soil.solid, random, 7, 0, 0, 0.07, 0.011)
  const plant = finish(body)
  group.add(finish(soil), plant)
  group.userData.boughs = [plant]
  return group
}

export const peach = {
  id: 'peach',
  drops: 40,
  /// stage：0 种子、1 芽、2 小苗、3 小树、4 长成（开满花）。返回这个样子的植物：THREE.Group，原点在土面正中，y 向上，单位是米。每次调用都新建一棵
  build(stage) {
    return [seed, sprout, seedling, tree, tree][stage](stage)
  },
  /// 每帧调一次，让它轻轻动一动（花枝微微晃）。group 是 build 返回的那个。可以很轻，但要便宜
  sway(group, time) {
    group.userData.boughs?.forEach((bough, k) => {
      bough.rotation.z = 0.02 * Math.sin(time * 1.1 + k * 1.7)
      bough.rotation.x = 0.015 * Math.sin(time * 0.8 + k * 2.6)
    })
  },
}
