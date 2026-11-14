// 单词屋窗下的花盆：盆、托盘、土、种在盆里的那一棵，旁边地上一只喷壶。浇水、长大、长成那一下的动画都在这里
import * as THREE from 'three'
import { at, mat, points, seeded, shade, smooth } from '../look.js'
import { stageOf, within } from './plants/stages.js'

const SOIL = 0.40
const RIM = 0.44
// 壶平时放的地方。壶嘴朝左、略朝里：朝右会戳进花盆，朝外会戳到浇水的小人（他站在 x -1.5..-0.5、z 0.4..1.4）
const REST = { x: -0.62, z: 0.18, turn: 2.9 }
// 倒水时壶底在哪儿（z = 0，壶嘴正朝 +x）。再往左，壶身就整个躲到小人身后、镜头看不见了
const POUR_X = -0.71
const UP = new THREE.Vector3(0, 1, 0)
// 壶嘴在壶自己的坐标里：从壶身前下方斜着往上伸，壶嘴朝 +x
const SPOUT = { from: new THREE.Vector3(0.138, 0.08, 0), way: new THREE.Vector3(0.756, 0.655, 0) }
const along = far => SPOUT.from.clone().addScaledVector(SPOUT.way, far)
const ROSE = along(0.546)
// 倒水时壶歪多少，歪过去以后莲蓬头相对壶底在哪儿
const TILT = -0.9
const TIP = ROSE.clone().applyEuler(new THREE.Euler(0, 0, TILT))
// 土浇湿了颜色深一点
const EARTH = { dry: new THREE.Color('#5B4334'), wet: new THREE.Color('#3E2D23') }
const TINTS = ['#FFC45C', '#FFE2A0', '#F7A93B', '#FFD27A'].map(color => new THREE.Color(color))

const paints = new Map()
const paint = color => paints.get(color) ?? paints.set(color, mat(color)).get(color)
// 夜里屋里很暗，水自己带一点亮才看得见
const WATER = mat('#C4E6F0', { emissive: '#6FB6D0', emissiveIntensity: 0.45 })
const GLINT = points({ size: 0.16, vertexColors: true, blending: THREE.AdditiveBlending })
const BEAD = new THREE.IcosahedronGeometry(1, 0)

const lathe = (profile, color, sides = 20) => shade(new THREE.Mesh(new THREE.LatheGeometry(profile.map(([far, y]) => new THREE.Vector2(far, y)), sides), paint(color)))
const rod = (top, bottom, tall, color, x = 0, y = 0, z = 0, sides = 12) => shade(at(new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, tall, sides), paint(color)), x, y, z))
const hoop = (radius, thick, color, sweep = Math.PI * 2) => shade(new THREE.Mesh(new THREE.TorusGeometry(radius, thick, 6, 16, sweep), paint(color)))
// 土面中间略鼓：离盆心 far 远的地方有多高
const mound = far => SOIL - 0.33 * far * far

/// 从 from 到 to 的一根管，两头可以不一样粗
function tube(from, to, wideFrom, wideTo, color) {
  const span = to.clone().sub(from)
  const mesh = rod(wideTo, wideFrom, span.length(), color, 0, 0, 0, 8)
  mesh.position.copy(from).addScaledVector(span, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, span.normalize())
  return mesh
}

/// 陶土盆：盆身带一点弧度往上放开，上面一圈外翻的厚盆沿，底下垫一只托盘
function vessel(earth) {
  const group = new THREE.Group()
  group.add(
    lathe([[0.25, 0], [0.274, 0.08], [0.294, 0.17], [0.308, 0.255], [0.311, 0.272], [0.322, 0.28], [0.322, 0.296], [0.314, 0.304], [0.318, 0.335]], '#B8663B'),
    lathe([[0.318, 0.335], [0.35, 0.343], [0.36, 0.37], [0.36, 0.424], [0.349, RIM], [0.32, RIM], [0.306, 0.424], [0.3, 0.34]], '#C2744C'),
    lathe([[0.27, 0], [0.33, 0.026], [0.345, 0.056], [0.328, 0.056], [0.304, 0.024], [0, 0.02]], '#A85C38'),
    soil(earth))
  return group
}

/// 土：坑坑洼洼地鼓着，上面撒几粒深浅不一的土块和小石子
function soil(earth) {
  const group = new THREE.Group()
  const bed = lathe([0.3, 0.22, 0.12, 0].map(far => [far, mound(far)]), '#5B4334', 14)
  const spot = bed.geometry.attributes.position
  // 高低按位置算、不按顶点序号算：旋转体接缝上两排顶点位置相同，按序号抖会裂开一条缝
  for (let k = 0; k < spot.count; k++) {
    const [x, z] = [spot.getX(k), spot.getZ(k)]
    const far = Math.hypot(x, z)
    // 最外一圈贴着盆壁不动，里面的顶点横着也挪一挪，不然土面是一圈整整齐齐的扇形
    const loose = far < 0.29 ? Math.min(1, far / 0.12) : 0
    spot.setXYZ(k, x + 0.03 * loose * Math.sin(z * 61 + x * 17), spot.getY(k) + 0.011 * Math.min(1, far / 0.12) * Math.sin(x * 43 + z * 29), z + 0.03 * loose * Math.cos(x * 53 - z * 23))
  }
  bed.material = earth
  group.add(bed)
  const random = seeded(7)
  for (const color of ['#4A372C', '#6E5341', '#9BA4A9', '#4A372C', '#D8CDB8', '#6E5341', '#4A372C', '#9BA4A9', '#6E5341']) {
    const turn = random.between(0, 6.28)
    const far = random.between(0.11, 0.26)
    const size = random.between(0.016, 0.032)
    const lump = shade(at(new THREE.Mesh(BEAD, paint(color)), Math.cos(turn) * far, mound(far) + size * 0.2, Math.sin(turn) * far))
    lump.scale.set(size, size * 0.62, size * random.between(0.8, 1.3))
    lump.rotation.y = turn * 3
    group.add(lump)
  }
  return group
}

/// 园艺喷壶：壶身、长壶嘴加莲蓬头、头顶的提手、背后的把手
function wateringCan() {
  const can = new THREE.Group()
  const [body, trim, brass] = ['#4E7FA8', '#F3EFE4', '#E9B949']
  const water = at(new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), paint('#8FC1D6')), 0, 0.247, 0)
  water.rotation.x = -Math.PI / 2
  // 壶口前半边盖着：歪过去倒水的时候水不会从壶口泼出来
  const lid = shade(at(new THREE.Mesh(new THREE.CylinderGeometry(0.161, 0.161, 0.014, 10, 1, false, 0, Math.PI), paint(body)), 0, 0.313, 0))
  const rim = at(hoop(0.164, 0.0105, trim), 0, 0.315, 0)
  const foot = at(hoop(0.176, 0.0125, trim), 0, 0.018, 0)
  rim.rotation.x = foot.rotation.x = Math.PI / 2
  const grip = at(hoop(0.14, 0.015, trim, Math.PI), 0, 0.3, 0)
  const back = at(hoop(0.113, 0.015, trim, Math.PI), -0.152, 0.172, 0)
  back.rotation.z = Math.PI / 2
  const rose = new THREE.Group()
  rose.position.copy(along(0.443))
  rose.quaternion.setFromUnitVectors(UP, SPOUT.way)
  rose.add(rod(0.069, 0.024, 0.08, brass, 0, 0.04), rod(0.062, 0.071, 0.018, brass, 0, 0.09))
  for (let k = 0; k < 7; k++) rose.add(rod(0.008, 0.008, 0.004, '#6B4A36', k && Math.cos(k * 1.047) * 0.039, 0.1, k && Math.sin(k * 1.047) * 0.039, 6))
  can.add(lathe([[0, 0], [0.172, 0], [0.163, 0.31], [0.15, 0.31], [0.147, 0.23]], body, 16), water, lid, rim, foot, grip, back, rose,
    tube(along(0), along(0.46), 0.041, 0.023, body), tube(new THREE.Vector3(0.15, 0.267, 0), along(0.3), 0.009, 0.009, trim))
  return can
}

/// 壶在半路上的样子。up：0 在地上、1 举到位；high：举到位时壶底多高；tilt：0 端平、1 歪过去倒水
function carry(can, up, high, tilt) {
  // 壶嘴从屋里那一侧（-z）绕过去，往镜头这边转会扫到小人；壶一边转一边往 z = 0 靠，背后的把手才不会甩到他身上。
  // 歪过去了才往左靠：端平的时候壶身更宽，再往左就过了 x = -0.85
  const turned = 1 - up * up
  can.position.set(REST.x + (POUR_X - REST.x) * tilt, high * up, REST.z * turned ** 1.5)
  can.rotation.set(0, REST.turn * turned, TILT * tilt)
}

/// 壶里倒出来的水滴，和落到土上溅起来的小水珠
function createRain(group) {
  const aim = new THREE.Vector3()
  const drops = Array.from({ length: 60 }, () => {
    const mesh = new THREE.Mesh(BEAD, WATER)
    mesh.visible = false
    group.add(mesh)
    return { mesh, velocity: new THREE.Vector3(), splashes: false }
  })
  function spray(spot, vx, vy, vz, size) {
    const drop = drops.find(one => !one.mesh.visible)
    if (!drop) return
    drop.mesh.position.copy(spot)
    drop.velocity.set(vx, vy, vz)
    drop.mesh.scale.set(size, size * 1.7, size)
    drop.mesh.visible = true
    drop.splashes = size > 0.015
  }
  return {
    /// 从莲蓬头（spot）喷出一颗：顺着壶嘴的方向（turn：壶绕 y 转了多少），带一点散开
    drip(spot, turn) {
      const speed = 0.08 + Math.random() * 0.22
      const side = (Math.random() - 0.5) * 0.36
      spot.y += (Math.random() - 0.5) * 0.07
      spray(spot, Math.cos(turn) * speed + Math.sin(turn) * side, -0.1 + (Math.random() - 0.5) * 0.24, Math.cos(turn) * side - Math.sin(turn) * speed, 0.019)
    },
    frame(dt) {
      for (const drop of drops) {
        if (!drop.mesh.visible) continue
        const spot = drop.mesh.position
        drop.velocity.y -= 6.5 * dt
        spot.addScaledVector(drop.velocity, dt)
        drop.mesh.quaternion.setFromUnitVectors(UP, aim.copy(drop.velocity).normalize())
        const far = Math.hypot(spot.x, spot.z)
        // 溅起来的小水珠碰到盆壁就没了，不然会翻到盆外面去
        if (spot.y > (far < 0.3 ? mound(far) : 0) && (drop.splashes || far < 0.29)) continue
        drop.mesh.visible = false
        if (!drop.splashes || far >= 0.3) continue
        spot.y = mound(far) + 0.012
        for (const side of [-1, 1]) spray(spot, side * (0.15 + Math.random() * 0.3), 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 0.009)
      }
    },
  }
}

/// 长成那一下从植物周围散开的暖色亮点
function createGlints(group) {
  const count = 48
  const spot = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  const tint = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  const cloud = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', spot).setAttribute('color', tint), GLINT)
  // 亮点一直在动，按最初的包围球裁剪会把它们整个裁掉
  cloud.frustumCulled = false
  cloud.visible = false
  group.add(cloud)
  const aim = new THREE.Vector3()
  const bits = Array.from({ length: count }, () => ({ velocity: new THREE.Vector3(), life: 0, span: 1, bright: 1 }))
  return {
    /// 从一棵枝叶伸出 reach 远、tall 高的植物表面往四周散开：大半绕着腰一圈，小半从上半截冒出来
    burst(reach, tall) {
      bits.forEach((bit, k) => {
        // 一个个错开黄金角：数量不多也铺得匀，不会挤成几堆
        const turn = k * 2.4
        const rise = k % 3 ? Math.random() * 0.6 - 0.1 : 0.6 + Math.random() * 0.8
        aim.set(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise))
        spot.setXYZ(k, aim.x * Math.max(0.16, reach) * 0.7, SOIL + tall * (0.5 + aim.y * 0.45), aim.z * Math.max(0.16, reach) * 0.7)
        bit.velocity.copy(aim).multiplyScalar(0.9 + Math.random() * 0.9)
        bit.span = 0.9 + Math.random() * 0.5
        // life 比 span 多出来的那一点是还没亮的时间：不是同一瞬间全冒出来
        bit.life = bit.span + Math.random() * 0.12
        bit.bright = 0.45 + Math.random() * 0.55
      })
      cloud.visible = true
    },
    frame(dt, time) {
      if (!cloud.visible) return
      cloud.visible = false
      bits.forEach((bit, k) => {
        bit.life -= dt
        cloud.visible ||= bit.life > 0
        const glow = bit.life > bit.span ? 0 : bit.bright * Math.max(0, Math.min(1, bit.life / bit.span * 2.2)) * (0.7 + 0.3 * Math.sin(time * 18 + k * 2.4))
        const color = TINTS[k % TINTS.length]
        tint.setXYZ(k, color.r * glow, color.g * glow, color.b * glow)
        if (bit.life > bit.span) return
        // 一出来很快，马上被空气拖慢，然后慢慢往上飘
        bit.velocity.multiplyScalar(Math.exp(-3 * dt)).y += 0.9 * dt
        spot.setXYZ(k, spot.getX(k) + bit.velocity.x * dt, spot.getY(k) + bit.velocity.y * dt, spot.getZ(k) + bit.velocity.z * dt)
      })
      spot.needsUpdate = tint.needsUpdate = true
    },
  }
}

/// 盆里种的那一棵：按浇了几成摆哪个样子、多大；换样子的时候弹一下
function createBed(group) {
  const holder = at(new THREE.Group(), 0, SOIL, 0)
  group.add(holder)
  // InstancedMesh 自己还有一份实例矩阵的缓冲，光扔几何体扔不掉它
  const scrap = model => model?.traverse(node => { node.geometry?.dispose(); node.dispose?.() })
  const sizeOf = model => { const box = new THREE.Box3().setFromObject(model); return { tall: box.max.y, reach: Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z) } }
  /// 换成这一种的第 k 个样子。旧模型的几何体是它自己的，要扔掉；材质是那一种共用的，不能扔
  function show(species, k) {
    scrap(bed.model)
    holder.clear()
    const model = species?.build(k) ?? null
    Object.assign(bed, { species, stage: k, model, tall: 0, reach: 0 }, model && sizeOf(model))
    if (model) holder.add(model)
  }
  const fit = () => bed.model?.scale.setScalar(stageOf(bed.grown) === bed.stage ? 0.8 + 0.2 * within(bed.grown) : 1)
  /// 噗地长出来：先矮胖，冲过头变瘦高，再落回原样
  function pop() {
    const push = 0.45 * Math.exp(-7 * bed.popped) * Math.cos(17 * bed.popped)
    holder.scale.set(1 + 0.35 * push, 1 - push, 1 + 0.35 * push)
  }
  const bed = {
    holder, species: null, grown: 0, stage: 0, model: null, tall: 0, reach: 0, popped: 9,
    set(species, grown) { show(species, stageOf(grown)); bed.grown = grown; bed.popped = 9; pop(); fit() },
    /// 长到 grown 成。跨过分界就换下一个样子、弹一下；一帧只换一个，一口气跨几个也一个个来，不跳过中间的
    grow(grown) {
      bed.grown = grown
      // 换上去的这一帧就得是压扁的：等下一帧再压，新样子会先原大闪一下
      if (stageOf(grown) > bed.stage) { show(bed.species, bed.stage + 1); bed.popped = 0; pop() }
      fit()
    },
    /// 浇到 grown 成的时候有多高（土面以上）。还没长到那个样子就先搭一棵量一下，量完扔掉
    tallAt(grown) {
      const scale = 0.8 + 0.2 * within(grown)
      if (stageOf(grown) === bed.stage) return bed.tall * scale
      const probe = bed.species.build(stageOf(grown))
      const { tall } = sizeOf(probe)
      scrap(probe)
      return tall * scale
    },
    frame(dt, time) {
      bed.popped += dt
      pop()
      holder.rotation.z = 0
      if (bed.model) bed.species.sway(bed.model, time)
    },
    get top() { return bed.model ? SOIL + bed.tall * bed.model.scale.y : RIM },
  }
  return bed
}

/// 浇水的一整套：提壶、歪过去、水落下来、植物长到 grown 成、壶放回原处。返回每一帧怎么摆（t：开始以后过了几秒）
function watering(parts, grown) {
  const { can, bed, rain } = parts
  const from = bed.grown
  const mouth = new THREE.Vector3()
  // 莲蓬头比植物高 0.3，按壶还举着的那段时间里它能长到多高算：照现在的个头举，它一长高就顶上去了。
  // 长成的那一下在最后，那时壶已经放回地上，不算在内——不然壶要举出镜头，下来的时候还会蹭到刚长开的树冠
  const high = Math.max(1, SOIL + bed.tallAt(Math.min(grown, 0.999)) + 0.3) - TIP.y
  let next = 0.85
  return t => {
    carry(can, smooth(0, 0.7, t) * (1 - smooth(2.05, 2.6, t)), high, smooth(0.58, 0.88, t) * (1 - smooth(1.9, 2.2, t)))
    // 放回地上的时候压扁一下，有分量
    can.scale.y = 1 - 0.08 * Math.sin(Math.PI * smooth(2.55, 2.75, t))
    for (; next <= Math.min(t, 1.9); next += 0.045) rain.drip(mouth.copy(ROSE).applyEuler(can.rotation).add(can.position), can.rotation.y)
    const eased = smooth(1.15, 2.55, t)
    bed.grow(eased < 1 ? from + (grown - from) * eased : grown)
    parts.wet = Math.max(parts.wet, smooth(1.15, 2.05, t))
    // 喝水的时候轻轻抖
    bed.holder.rotation.z = 0.03 * Math.sin(t * 14) * smooth(1.15, 1.45, t) * (1 - smooth(2.35, 2.75, t))
  }
}

/// 长成的那一下：植物先往下一蹲，再猛地蹿高、晃几下停住，蹿起来的时候亮点散开。返回每一帧怎么摆
function cheering({ bed, glints }) {
  let burst = false
  return t => {
    const press = smooth(0, 0.2, t) * (1 - smooth(0.2, 0.34, t))
    const spring = t > 0.2 ? Math.exp(-4.2 * (t - 0.2)) * Math.sin(15 * (t - 0.2)) : 0
    bed.holder.scale.set(1 + 0.1 * press - 0.1 * spring, 1 - 0.16 * press + 0.2 * spring, 1 + 0.1 * press - 0.1 * spring)
    bed.holder.rotation.z = t > 0.2 ? 0.07 * Math.exp(-3 * (t - 0.2)) * Math.sin(22 * (t - 0.2)) : 0
    if (t >= 0.2 && !burst) { burst = true; glints.burst(bed.reach, bed.top - SOIL) }
  }
}

export function createPot() {
  const group = new THREE.Group()
  const can = wateringCan()
  // 土的颜色跟着干湿变，所以每只盆自己一份材质
  const earth = mat('#5B4334')
  group.add(vessel(earth), can)
  const parts = { can, bed: createBed(group), rain: createRain(group), glints: createGlints(group), wet: 0 }
  const { bed } = parts
  let act = null
  carry(can, 0, 0, 0)

  /// 上一段动作还没放完又来了新的：直接摆成放完的样子，把它了结掉
  function settle() {
    if (!act) return
    const { done, goal } = act
    act = null
    carry(can, 0, 0, 0)
    can.scale.y = 1
    if (goal !== undefined) bed.set(bed.species, goal)
    done()
  }
  /// 放一段 long 秒的动作，放完了结。make() 给出每一帧怎么摆；goal：这段放完植物该是几成。空盆没什么可放的
  const play = (long, make, goal) => { settle(); return bed.species ? new Promise(done => { act = { at: 0, long, step: make(), done, goal } }) : Promise.resolve() }

  return {
    group, can,
    /// 立刻摆成这个样子，没有动画。species 为 null 是空盆；grown：浇了几成（0..1）
    plant(species, grown) { settle(); bed.set(species, species ? grown : 0) },
    /// 浇水，植物从现在长到 grown 成。返回的 Promise 在壶放回原处、植物弹完以后了结（3.1 秒）
    water(grown) { return play(3.1, () => watering(parts, grown), grown) },
    /// 长成的那一下庆祝。返回的 Promise 1.6 秒后了结，亮点还会再飘一小会儿
    bloom() { return play(1.6, () => cheering(parts)) },
    frame(dt, time) {
      bed.frame(dt, time)
      if (act) {
        act.at = Math.min(act.long, act.at + dt)
        act.step(act.at)
        if (act.at >= act.long) { act.done(); act = null }
      }
      parts.rain.frame(dt)
      parts.glints.frame(dt, time)
      parts.wet = Math.max(0, parts.wet - dt / 8)
      earth.color.lerpColors(EARTH.dry, EARTH.wet, parts.wet)
    },
    /// 现在这棵的顶离地板多高；空盆是盆沿的高度
    get top() { return bed.top },
  }
}
