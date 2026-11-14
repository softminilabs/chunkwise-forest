// 花盆里养成的树和花，种进森林里。每种只建一次模型，按材质并成几块，再用实例画到各个位置上
import * as THREE from 'three'
import { mat, seeded } from '../look.js'
import { t } from '../i18n.js'
import { SPOTS as CHESTS } from './chests.js'
import { CABINS, CLEARING, LODGE, STREAM, distanceTo, height, nearPath, trailX } from './land.js'
import { PLANTS } from './plants/index.js'
import { TREES } from './woods.js'

export const HABITAT = { pine: 'tree', peach: 'flower' }
// 移栽以后放大几倍：松树比小人高一头，是林子里的小树；花矮一点，不能高过屋檐
const SCALE = { tree: 2.2, flower: 2 }
const SINK = 0.06
const GIRTH = { tree: 0.45, flower: 0.4 }
const SNOW = mat('#F4F8FA')
const UP = new THREE.Vector3(0, 1, 0)
const dummy = new THREE.Object3D()

/// 小路边上的一个位置：贴着两边原有的树线（林子从离路 6 米多才开始），不是站在人走的那条空地里。
/// 正好落在木屋的岔路口、挤着原有的树、或者挨着已经排好的一棵，就沿着路前后挪一挪
function roadside(z, side, random, taken) {
  const reach = side * random.between(5.3, 6)
  const turn = random.next() * 6.28
  for (const nudge of [0, 1.5, -1.5, 3, -3, 4.5, -4.5]) {
    const lean = trailX(z + nudge + 0.5) - trailX(z + nudge - 0.5)
    const x = trailX(z + nudge) + reach / Math.hypot(1, lean)
    const far = z + nudge - reach * lean / Math.hypot(1, lean)
    // 原有的树冠大约是 1.5 × size 那么宽，再留出这棵小树自己的一圈
    if (nearPath(x, far) < 3.3 || taken.some(other => Math.hypot(other.x - x, other.z - far) < 3.6) || TREES.some(tree => Math.hypot(tree.x - x, tree.z - far) < 1.5 * tree.size + 1.2)) continue
    return { x, z: far, turn, where: t('小路旁，第 {n} 间木屋附近', { n: cabinNear(far) }) }
  }
  return null
}

/// 按南北位置算，这儿挨着第几间木屋
const cabinNear = z => Math.min(9, Math.max(1, Math.round((-9 - z) / 11.5) + 1))

/// 树：从空地的北口一路往北，一左一右交替；走完一趟，第二趟再把对面补上。flowers：花的位置，树要让开
function treeSpots(flowers) {
  const random = seeded(31)
  const spots = []
  for (const lap of [0, 1]) {
    for (let k = 0; k < 17; k++) {
      const spot = roadside(-10.5 - k * 6.5 + random.between(-1, 1), (k + lap) % 2 ? -1 : 1, random, [...flowers, ...spots])
      if (spot) spots.push(spot)
    }
  }
  return spots
}

/// 屋子正面的两个墙角外各一个：不挡门，也不挡窗。facing：门朝哪边；half：离门的中线多远
function doorway(house, facing, half, where) {
  const [fx, fz] = [Math.sin(facing), Math.cos(facing)]
  const pair = () => [-1, 1].map(side => ({ x: house.x + fx * 2.9 + side * fz * half, z: house.z + fz * 2.9 - side * fx * half, where }))
  // 有的屋子门前藏着一只宝箱（第 7 间）：两边一起再往外让，让开了还是对称的
  while (pair().some(spot => Object.values(CHESTS).some(([x, z]) => Math.hypot(x - spot.x, z - spot.z) < 2.6))) half += 0.4
  return pair()
}

/// 单词屋：门前那段小路快到头的地方，路两边各一个。不摆在屋角：从开场的镜头看过去，右边那个正好压在圣诞树的星星后面
function lodgeGate(where) {
  // 和 land.js 里通单词屋那条岔路的两头一致
  const [from, to] = [[CLEARING.x, CLEARING.z + 1], [LODGE.x - 4, LODGE.z + 1.5]]
  const long = Math.hypot(to[0] - from[0], to[1] - from[1])
  const [dx, dz] = [(to[0] - from[0]) / long, (to[1] - from[1]) / long]
  return [-1, 1].map(side => ({ x: to[0] - dx * 1.5 - side * dz * 2.8, z: to[1] - dz * 1.5 + side * dx * 2.8, where }))
}

// 空地边上：从正北顺时针量的角度，按先种哪个排。只有北边和东边这半圈：西半圈从开场的镜头看过去正好在灯笼树背后，
// 种了就把那几只灯笼搅乱了；小路南北两头、通单词屋的岔路、那只宝箱的位置也空着
const RING = [38, 320, 156, 8]

/// 花：单词屋门口、第 1 间木屋门口、空地边上、再是后面八间木屋门口
function flowerSpots() {
  const random = seeded(53)
  // 门的朝向和 cabins.js 里摆屋子用的是同一个算法
  const doors = CABINS.map((cabin, k) => doorway(cabin, -cabin.side * (Math.PI / 2 - 0.5), 3.4, t('第 {n} 间木屋门口', { n: k + 1 })))
  const ring = RING.map(angle => ({ x: CLEARING.x + Math.sin(angle * Math.PI / 180) * 8.6, z: CLEARING.z - Math.cos(angle * Math.PI / 180) * 8.6, where: t('篝火空地边') }))
  return [...lodgeGate(t('单词屋门口')), ...doors[0], ...ring, ...doors.slice(1).flat()].map(spot => ({ ...spot, turn: random.next() * 6.28 }))
}

/// 每一类东西在林子里的位置表，按「先种哪儿」排好。每个位置：{ x, z, turn, where }
export const SPOTS = { flower: flowerSpots() }
SPOTS.tree = treeSpots(SPOTS.flower)

// 路边和门口排满以后，接着种进林子里原有的树之间的空地：地图不用扩，位置多出一两倍

/// 一棵原有的树在离地 up 米高的地方有多宽（半径），高过树梢是 0。松树是越往上越尖的三层；阔叶树是一团球，旁边还挂着一小团
function girthAt(tree, up) {
  const k = up / tree.size
  if (tree.pine) return Math.max(0, 1.6 * (5.05 - k) / 4.25) * tree.size
  return (k < 3.5 ? 1.9 : 1.5 * Math.sqrt(Math.max(0, 1 - ((k - 3.2) / 1.3) ** 2))) * tree.size
}

/// 从镜头那边看，这一点是不是被挡在后面。镜头在人的正南、斜着往下看：视线从齐胸高往南每米升 0.43 米，
/// 南边有树或木屋在视线那么高的地方正好挡着，种在这儿就看不见
function hidden(x, z) {
  const eye = height(x, z) + 1.2
  const line = south => eye + 0.43 * south
  const behind = tree => { const wide = girthAt(tree, line(tree.z - z) - tree.y); return wide > 0 && Math.abs(tree.x - x) < wide + 0.8 }
  // 木屋按它靠北的那面墙算：烟囱不在正中间，量到屋子中心会漏掉
  return TREES.some(tree => tree.z > z && behind(tree)) || CABINS.some(cabin => cabin.z > z && line(Math.max(0, cabin.z - z - 3)) < 5.4 && Math.abs(cabin.x - x) < 5.2)
}

/// 「去看看」时人站在哪儿：稍微靠前，先挑它朝小路的那一侧；从镜头看过去被挡住了，就依次换另一侧、正前方、两边再远一点
export function standBy({ x, z }) {
  const side = Math.sign(trailX(z) - x) || 1
  const places = [[side * 2.2, 1.4], [-side * 2.2, 1.4], [0, 2.6], [side * 4, 0.6], [-side * 4, 0.6]].map(([dx, dz]) => ({ x: x + dx, z: z + dz }))
  return places.find(place => !hidden(place.x, place.z)) ?? places[0]
}

/// 这一点能不能种：在路边那一排的外面，不挤着溪水、木屋、宝箱、原有的树和已经排好的位置；
/// 它自己和「去看看」时站在旁边的人都要看得见
function roomy(x, z, taken) {
  const stand = standBy({ x, z })
  if (nearPath(x, z) < 6.4 || distanceTo(STREAM, x, z) < 3.5 || hidden(x, z) || hidden(stand.x, stand.z)) return false
  if (CABINS.some(cabin => Math.hypot(cabin.x - x, cabin.z - z) < 5.2) || Object.values(CHESTS).some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.6)) return false
  return !taken.some(other => Math.hypot(other.x - x, other.z - z) < 3.6) && !TREES.some(tree => Math.hypot(tree.x - x, tree.z - z) < 1.5 * tree.size + 1.2)
}

/// 林子里的空地：随手撒点，能种的留下。挨着木屋的归花（每间屋旁最多 4 个，从第 1 间排起），
/// 其余归树（离小路近的一圈先种，一圈里从南往北）。
/// 只在空地以北找：往南是开场镜头看得到的那一片，多出东西会搅乱那个画面
function deepSpots() {
  const random = seeded(71)
  const taken = [...SPOTS.flower, ...SPOTS.tree]
  const found = []
  for (let k = 0; k < 6000; k++) {
    const spot = { x: random.between(-21, 24), z: random.between(-114, -9), turn: random.next() * 6.28 }
    if (!roomy(spot.x, spot.z, taken)) continue
    taken.push(spot)
    found.push(spot)
  }
  const gap = (cabin, spot) => Math.hypot(cabin.x - spot.x, cabin.z - spot.z)
  const ring = spot => Math.floor(nearPath(spot.x, spot.z) / 6)
  const wild = found.filter(spot => CABINS.every(cabin => gap(cabin, spot) > 9)).sort((p, q) => ring(p) - ring(q) || q.z - p.z)
  return {
    tree: wild.map(spot => ({ ...spot, where: t('林子里，第 {n} 间木屋附近', { n: cabinNear(spot.z) }) })),
    flower: CABINS.flatMap((cabin, k) => found.filter(spot => gap(cabin, spot) <= 9).sort((p, q) => gap(cabin, p) - gap(cabin, q)).slice(0, 4)
      .map(spot => ({ ...spot, where: t('第 {n} 间木屋旁', { n: k + 1 }) }))),
  }
}
for (const [kind, spots] of Object.entries(deepSpots())) SPOTS[kind].push(...spots)

function geometryOf(position, color) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  if (color) geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  // 平涂用不着法线，可接影子时的偏移要用
  geometry.computeVertexNormals()
  return geometry
}

/// 把长成的模型按材质并成几块：这一种在整片林子里，一块只画一次。
/// 模型里本来就是实例的（桃花的花瓣、叶子），矩阵和颜色都乘进顶点里
function flatten(model) {
  const piles = new Map()
  const [matrix, local, point, tint, own] = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Vector3(), new THREE.Color(), new THREE.Color()]
  model.updateMatrixWorld(true)
  model.traverse(node => {
    if (!node.isMesh) return
    if (!piles.has(node.material)) piles.set(node.material, { position: [], color: [] })
    const pile = piles.get(node.material)
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry
    const { position, color } = geometry.attributes
    for (let k = 0; k < (node.count ?? 1); k++) {
      matrix.copy(node.matrixWorld)
      own.setRGB(1, 1, 1)
      if (node.isInstancedMesh) { node.getMatrixAt(k, local); matrix.multiply(local); if (node.instanceColor) node.getColorAt(k, own) }
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(matrix)
        pile.position.push(point.x, point.y, point.z)
        if (node.material.vertexColors && color) tint.fromBufferAttribute(color, i).multiply(own)
        else tint.copy(own)
        pile.color.push(tint.r, tint.g, tint.b)
      }
    }
  })
  // 材质另用一份：实例的颜色现在写在顶点上了，要认顶点色；自发光在林子里还要跟着昼夜变
  return [...piles].map(([material, pile]) => ({ geometry: geometryOf(pile.position, pile.color), material: Object.assign(material.clone(), { vertexColors: true }) }))
}

/// 从正上方看下去接得到雪的面：每一小格里最高的那一个。返回 [{ point, normal }]，法线一律朝上
function tops(piles, cell) {
  const best = new Map()
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  for (const { geometry } of piles) {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2)
      const point = a.clone().add(b).add(c).divideScalar(3)
      const key = `${Math.round(point.x / cell)},${Math.round(point.z / cell)}`
      if (best.get(key)?.point.y >= point.y) continue
      const normal = b.clone().sub(a).cross(c.sub(a)).normalize()
      best.set(key, { point, normal: normal.y < 0 ? normal.negate() : normal })
    }
  }
  return [...best.values()]
}

/// 冬天的雪，什么模型都是这一套：在接得到雪、朝天、又靠顶上的地方挑几处，各堆一摊压扁的小雪块
function snowOn(piles, random) {
  const box = new THREE.Box3()
  for (const { geometry } of piles) { geometry.computeBoundingBox(); box.union(geometry.boundingBox) }
  const size = box.getSize(new THREE.Vector3())
  const cell = Math.max(size.x, size.z) / 18
  const faces = tops(piles, cell).filter(top => top.normal.y > 0.3).sort((p, q) => q.point.y - p.point.y)
  // 最高的那一处一定有（树梢上的雪帽），其余的越高越容易挑中
  const ranked = faces.map((top, k) => ({ top, rank: k ? top.point.y / size.y + random.next() * 0.3 : 9 })).sort((p, q) => q.rank - p.rank)
  const sites = []
  for (const { top } of ranked) {
    if (sites.length === 7) break
    if (sites.every(other => other.point.distanceTo(top.point) > cell * 4)) sites.push(top)
  }
  const lumps = []
  for (const site of sites) {
    const wide = size.y * random.between(0.045, 0.058)
    lumps.push([site, wide, 1])
    // 旁边再挨一两团小的：雪是一摊一摊的，不是一粒一粒匀着撒的
    const beside = faces.filter(top => { const gap = top.point.distanceTo(site.point); return gap > wide * 0.6 && gap < wide * 1.3 })
    for (let n = random.next() < 0.5 ? 1 : 2; n > 0 && beside.length; n--) lumps.push([random.pick(beside), wide * random.between(0.5, 0.75), 0])
  }
  return geometryOf(lumps.flatMap(([top, wide, detail]) => [...lumpAt(top, wide, detail, random).attributes.position.array]))
}

/// 一团雪：压扁的多面体，基本是平着搁的，只顺着坡面歪一点（全顺着坡像贴上去的棉花球）；
/// 再往坡里靠一靠、往下陷一点，不然像一只悬在枝外头的盘子
function lumpAt({ point, normal }, wide, detail, random) {
  dummy.quaternion.setFromUnitVectors(UP, normal.clone().multiplyScalar(0.5).add(UP).normalize())
  dummy.rotateY(random.next() * 6.28)
  dummy.position.set(point.x - normal.x * wide * 0.4, point.y - wide * 0.1, point.z - normal.z * wide * 0.4)
  dummy.scale.set(wide * random.between(1, 1.4), wide * 0.5, wide)
  dummy.updateMatrix()
  return new THREE.IcosahedronGeometry(1, detail).applyMatrix4(dummy.matrix)
}

/// 一种种子在林子里的全部：模型并成的几块、加上雪，各是一个实例网格，位置表有多长就留多少个位子
function createKind(scene, seed) {
  const piles = flatten(PLANTS[seed].build(4))
  const layer = (geometry, material) => {
    const mesh = new THREE.InstancedMesh(geometry, material, SPOTS[HABITAT[seed]].length)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.count = 0
    scene.add(mesh)
    return mesh
  }
  const snow = layer(snowOn(piles, seeded(17)), SNOW)
  snow.castShadow = false
  const glows = piles.map(({ material }) => ({ material, glow: material.emissiveIntensity }))
  return { meshes: [...piles.map(pile => layer(pile.geometry, pile.material)), snow], snow, glows, scale: SCALE[HABITAT[seed]] }
}

/// 把一棵摆到它的位置上。size：长到几成大（弹出来的时候用）
function lay({ kind, index, spot }, size = 1) {
  dummy.position.set(spot.x, height(spot.x, spot.z) - SINK * size, spot.z)
  dummy.rotation.set(0, spot.turn, 0)
  dummy.scale.setScalar(kind.scale * Math.max(0.001, size))
  dummy.updateMatrix()
  for (const mesh of kind.meshes) { mesh.setMatrixAt(index, dummy.matrix); mesh.instanceMatrix.needsUpdate = true }
}

/// 推进「从地里长出来」：0.7 秒里从很小弹到正常大小，先略大一成再回落
function advance(growing, dt) {
  for (const grow of [...growing]) {
    grow.time += dt
    const k = Math.min(1, grow.time / 0.7) - 1
    lay(grow.item, 1 + 2.70158 * k ** 3 + 1.70158 * k ** 2)
    if (k) continue
    growing.splice(growing.indexOf(grow), 1)
    grow.done()
  }
}

export function createPlanted(scene, colliders, weather) {
  const kinds = {}
  const placed = new Map()
  const fences = []
  const growing = []
  let winter = false
  const meshes = () => Object.values(kinds).flatMap(kind => kind.meshes)

  return {
    /// 把这些摆进林子。items：[{ seed: 'pine' | 'peach', slot }]，slot 是它在自己那一类位置表里排第几
    set(items) {
      for (const grow of growing.splice(0)) grow.done()
      for (const fence of fences.splice(0)) colliders.splice(colliders.indexOf(fence), 1)
      placed.clear()
      for (const mesh of meshes()) mesh.count = 0
      for (const { seed, slot } of items) {
        const spot = SPOTS[HABITAT[seed]][slot]
        // 位置表排满了，多出来的先不种
        if (!spot) continue
        const kind = kinds[seed] ??= createKind(scene, seed)
        const item = { kind, index: kind.snow.count, spot }
        for (const mesh of kind.meshes) mesh.count = item.index + 1
        lay(item)
        placed.set(`${seed}:${slot}`, item)
        fences.push({ x: spot.x, z: spot.z, r: GIRTH[HABITAT[seed]] })
      }
      colliders.push(...fences)
      for (const kind of Object.values(kinds)) kind.snow.visible = winter
      // 实例挪了位置，包围球要重算，不然镜头转过去会被整个裁掉
      for (const mesh of meshes()) mesh.computeBoundingSphere()
    },
    /// 换季时叫：冬天顶上落一层薄雪，别的季节就是长成时的样子
    paint(look, season) {
      winter = season === 'winter'
      for (const kind of Object.values(kinds)) kind.snow.visible = winter
    },
    /// 让这一棵从地里长出来，约 0.7 秒。要先用 set() 把它摆进去。返回的 Promise 在弹完时了结；中途又 set() 了，就按最终大小摆好、当场了结
    sprout(seed, slot) {
      const item = placed.get(`${seed}:${slot}`)
      lay(item, 0)
      return new Promise(done => growing.push({ item, time: 0, done }))
    },
    /// 每帧调一次
    update(dt) {
      // 花瓣、嫩叶自带的那点亮是模拟透光的：天黑了没有光可透，得跟着暗下去，不然夜里只有它们自己亮着
      for (const kind of Object.values(kinds)) for (const { material, glow } of kind.glows) material.emissiveIntensity = glow * (1 - 0.85 * weather.now.night)
      advance(growing, dt)
    },
  }
}
