// 天色和天气。季节默认跟着真实的日子、昼夜默认跟着真实的时间，都可以在「森林」面板里改成固定的。
// 这里管：光、雾、天空的颜色，还有飘着的东西——雨、雪、落叶、萤火虫、星星、流星
import * as THREE from 'three'
import { LOOK, NIGHT_SKY, damp, leafGeometry, points, seasonOf, seeded, smooth, weathersOf } from '../look.js'

const random = seeded(3)
const cloud = (count, make, material) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: count }, make).flat()), 3))
  const node = new THREE.Points(geometry, material)
  node.frustumCulled = false
  return node
}

// 飘的东西都活动在罩着人的一个盒子里，但位置是森林里的固定位置：人往前走，它们留在原地，
// 走出盒子的那些从另一头补进来。要是整团绑在人身上，看着就是一群点跟着人飘
const BOX = { x: 84, z: 72 }
const wrap = (value, center, size) => center + ((((value - center + size / 2) % size) + size) % size) - size / 2
// 雨有大小：春天是小雨，夏天是雷雨
const RAIN = { spring: 200, summer: 520, autumn: 340 }

const scatter = (count, top) => Array.from({ length: count }, () => ({ x: random.between(-BOX.x / 2, BOX.x / 2), y: random.between(0, top), z: random.between(-BOX.z / 2, BOX.z / 2), speed: random.between(0.7, 1.3), phase: random.next() * 6.28 }))

/// 雨：一根根斜着的短线。返回每帧调一次的函数
function createRain(scene) {
  const drops = scatter(520, 26)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(drops.length * 6), 3))
  const rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5 }))
  rain.frustumCulled = false
  scene.add(rain)
  return (dt, focus, now) => {
    rain.visible = now.weather === 'rain'
    if (!rain.visible) return
    const position = geometry.attributes.position
    geometry.setDrawRange(0, (RAIN[now.season] ?? 340) * 2)
    drops.forEach((drop, i) => {
      drop.y -= 34 * drop.speed * dt
      if (drop.y < 0) drop.y += 26
      drop.x = wrap(drop.x, focus.x, BOX.x)
      drop.z = wrap(drop.z, focus.z - 6, BOX.z)
      position.setXYZ(i * 2, drop.x, focus.y + drop.y, drop.z)
      position.setXYZ(i * 2 + 1, drop.x - 0.25, focus.y + drop.y + 1.2, drop.z)
    })
    position.needsUpdate = true
  }
}

/// 落叶：一片片叶子形状的薄片，边落边翻，只在秋天有。受光照，夜里会暗下去，不会像灯一样亮着。
/// 春天原来飘粉色的花瓣，夜里被木屋的暖光一照是橙色的，看着就是「春天在落叶」，所以去掉了
function createLeaves(scene) {
  const leaves = new THREE.InstancedMesh(leafGeometry(0.36), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), 64)
  leaves.frustumCulled = false
  const falling = scatter(64, 9)
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  scene.add(leaves)
  return {
    /// 换季：落叶用这一季树叶的颜色
    paint(look) {
      const colors = look.leaf
      falling.forEach((_, i) => leaves.setColorAt(i, tint.set(colors[i % colors.length])))
      leaves.instanceColor.needsUpdate = true
    },
    update(dt, time, focus, now) {
      leaves.visible = now.season === 'autumn' && now.weather !== 'rain'
      if (!leaves.visible) return
      falling.forEach((leaf, i) => {
        leaf.y -= 0.9 * leaf.speed * dt
        if (leaf.y < 0) leaf.y += 9
        leaf.x = wrap(leaf.x + (0.5 + Math.sin(time * 0.9 + leaf.phase)) * 0.7 * dt, focus.x, BOX.x)
        leaf.z = wrap(leaf.z, focus.z - 6, BOX.z)
        dummy.position.set(leaf.x, focus.y + leaf.y, leaf.z)
        dummy.rotation.set(time * leaf.speed * 1.7 + leaf.phase, leaf.phase, time * leaf.speed + leaf.phase * 2)
        dummy.updateMatrix()
        leaves.setMatrixAt(i, dummy.matrix)
      })
      leaves.instanceMatrix.needsUpdate = true
    },
  }
}

/// 飘在空中的全部：雨、落叶，加上雪和萤火虫这两团点
function createAir(scene) {
  const rain = createRain(scene)
  const leaves = createLeaves(scene)
  const cloudOf = (list, material) => { const node = cloud(list.length, () => [0, 0, 0], material); node.userData.list = list; return node }
  const snow = cloudOf(scatter(700, 22), points({ color: '#FFFFFF', size: 0.34, opacity: 0.95 }))
  const flies = cloudOf(scatter(46, 3.2), points({ color: '#E4F26A', size: 0.5, fog: false, blending: THREE.AdditiveBlending }))
  scene.add(snow, flies)

  function place(node, focus, dt, fall, sway, time, top) {
    const position = node.geometry.attributes.position
    node.userData.list.forEach((item, i) => {
      item.y -= fall * item.speed * dt
      if (item.y < 0) item.y += top
      item.x = wrap(item.x + Math.sin(time * 0.8 + item.phase) * sway * dt, focus.x, BOX.x)
      item.z = wrap(item.z, focus.z - 6, BOX.z)
      position.setXYZ(i, item.x, focus.y + item.y, item.z)
    })
    position.needsUpdate = true
  }

  return {
    paint: leaves.paint,
    update(dt, time, focus, now) {
      rain(dt, focus, now)
      leaves.update(dt, time, focus, now)
      snow.visible = now.weather === 'snow'
      flies.visible = now.season === 'summer' && now.night > 0.5 && now.weather !== 'rain'
      if (snow.visible) place(snow, focus, dt, 2.4, 0.6, time, 22)
      if (flies.visible) { place(flies, focus, dt, 0, 1.2, time, 3.2); flies.material.opacity = 0.6 + Math.sin(time * 3) * 0.3 }
    },
  }
}

// 流星往左下划，每往左一米落这么多
const SLOPE = 0.45

/// 天上的：星星一直在，夜里才显出来；流星隔几秒划一道
function createHeaven(scene) {
  // 抬头看天时画面只到仰角二十度上下，所以星星多半撒在低处
  const stars = cloud(900, () => { const a = random.next() * 6.28; const up = 0.06 + random.next() ** 2 * 1.14; return [Math.cos(a) * Math.cos(up) * 170, Math.sin(up) * 170, Math.sin(a) * Math.cos(up) * 170] }, points({ color: '#FFFFFF', size: 2.4, sizeAttenuation: false, fog: false, opacity: 0 }))
  // 流星是一条头亮尾暗、尾巴收成尖的光带。画成线的话永远只有一个像素宽，高分屏上几乎看不见
  const streak = new THREE.PlaneGeometry(1, 0.55)
  streak.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0.04, 0.08, 0.16, 1, 1, 1, 0.04, 0.08, 0.16]), 3))
  streak.attributes.position.setY(1, 0).setY(3, 0)
  const meteors = Array.from({ length: 3 }, () => {
    const mesh = new THREE.Mesh(streak, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    mesh.frustumCulled = false
    mesh.rotation.z = Math.atan(SLOPE)
    const pivot = new THREE.Group()
    pivot.add(mesh)
    return { pivot, mesh, life: 0, x: 0, y: 0, long: 10 }
  })
  const aim = new THREE.Vector3()
  const group = new THREE.Group()
  group.add(stars, ...meteors.map(meteor => meteor.pivot))
  scene.add(group)
  let next = 1.5
  return {
    update(dt, camera, scene) {
      group.position.copy(camera.position)
      // 雨雪天是阴的，看不到星星
      stars.material.opacity = scene.weather === 'clear' || scene.weather === 'meteor' ? scene.night * 0.9 : 0
      next -= dt
      if (scene.weather === 'meteor' && scene.night > 0.6 && next <= 0) {
        const idle = meteors.find(meteor => meteor.life <= 0)
        if (idle) {
          Object.assign(idle, { life: 1, x: random.between(-20, 80), y: random.between(22, 44), long: random.between(10, 20) })
          idle.mesh.scale.x = idle.long * Math.hypot(1, SLOPE)
          // 流星划在镜头正对着的那片天上：镜头转到哪边都看得到
          camera.getWorldDirection(aim)
          idle.pivot.rotation.y = Math.atan2(-aim.x, -aim.z)
        }
        next = random.between(1.2, 3.6)
      }
      for (const meteor of meteors) {
        if (meteor.life <= 0) { meteor.mesh.material.opacity = 0; continue }
        meteor.life -= dt * 1.3
        // 头在左下、尾在右上；光带的中心比头靠后半个身长
        const run = (1 - meteor.life) * 46 - meteor.long / 2
        meteor.mesh.position.set(meteor.x - run, meteor.y - run * SLOPE, -130)
        meteor.mesh.material.opacity = Math.sin(Math.max(0, meteor.life) * Math.PI)
      }
    },
  }
}

export function createWeather(scene, renderer, state) {
  const sun = new THREE.DirectionalLight('#ffffff', 2.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 5, far: 140 })
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.04
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1.5)
  scene.add(sun, sun.target, hemi)
  scene.fog = new THREE.Fog('#ffffff', 34, 118)
  const air = createAir(scene)
  const heaven = createHeaven(scene)
  // night 一开始就是这会儿该有的天色：从 0 起步的话，夜里每次打开都要先看两秒「天黑下来」
  const now = { season: 'autumn', weather: 'clear', night: nightGoal(), painted: -1, paintedSeason: '', dark: false }
  const listeners = []
  // 季节、天气、昼夜换了以后要知道的人（顶上「森林」按钮上的字）
  const watchers = []
  const [top, low, mix] = [new THREE.Color(), new THREE.Color(), new THREE.Color()]

  /// 按「森林」面板里的选择定下现在是什么季节、什么天气；季节变了就通知地面、树、木屋重新上色
  function resolve() {
    const wish = state.town.scene
    const season = wish.season === 'auto' ? seasonOf() : wish.season
    // 这个季节、这个时候不会有的天气要换掉，并且记下来，面板上才对得上：
    // 雨和雪互相顶替（秋天的雨到了冬天就是雪），白天的流星改回晴
    const allowed = weathersOf(season, nightGoal() > 0.5)
    const falling = wish.weather === 'rain' || wish.weather === 'snow'
    const weather = allowed.includes(wish.weather) ? wish.weather : falling ? allowed[1] : 'clear'
    if (weather !== wish.weather) state.patch({ scene: { ...wish, weather } })
    now.weather = weather
    if (season === now.season && now.paintedSeason) { for (const watcher of watchers) watcher(); return }
    now.season = season
    now.paintedSeason = season
    now.painted = -1
    for (const listener of listeners) listener(LOOK[season], season)
    air.paint(LOOK[season])
    for (const watcher of watchers) watcher()
  }

  function nightGoal() {
    const wish = state.town.scene.time
    if (wish !== 'auto') return wish === 'night' ? 1 : 0
    const date = new Date()
    return 1 - smooth(-0.18, 0.32, Math.sin((date.getHours() + date.getMinutes() / 60 - 6) / 12 * Math.PI))
  }

  /// 天空是页面的背景渐变，雾取天边那个色：远处的树就淡进天里
  function paint() {
    const look = LOOK[now.season]
    const dark = NIGHT_SKY[now.season]
    const gloom = now.weather === 'rain' ? 0.28 : now.weather === 'snow' ? 0.12 : 0
    top.set(look.sky[0]).lerp(mix.set(dark[0]), Math.max(now.night, gloom))
    low.set(look.sky[1]).lerp(mix.set(dark[1]), Math.max(now.night, gloom))
    document.body.style.setProperty('--sky-top', `#${top.getHexString()}`)
    document.body.style.setProperty('--sky-low', `#${low.getHexString()}`)
    scene.fog.color.copy(low)
    scene.fog.near = 34 - now.night * 8
    scene.fog.far = 118 - now.night * 22
    sun.color.set(look.sun).lerp(mix.set('#9DB7E0'), now.night)
    sun.intensity = (2.5 - now.night * 1.95) * (1 - gloom * 1.4)
    hemi.color.copy(top).lerp(mix.set('#33507A'), now.night * 0.6)
    hemi.groundColor.set(look.ground[0]).lerp(mix.set('#0E1A1C'), now.night)
    hemi.intensity = 1.55 - now.night * 0.65
    renderer.toneMappingExposure = 1.05 + now.night * 0.2
    now.painted = now.night
  }

  return {
    now,
    /// 现在算不算夜里。看的是要去的那一头：刚切成夜晚、天还没黑透时，面板上就该有流星可选了
    get dark() { return nightGoal() > 0.5 },
    onSeason(listener) { listeners.push(listener) },
    onChange(watcher) { watchers.push(watcher) },
    resolve,
    update(dt, time, focus, camera) {
      const goal = nightGoal()
      now.night = damp(now.night, goal, 1.6, dt)
      // 跟着真实时间走的时候，天黑、天亮是自己发生的：天亮了流星要收掉，顶上的字也要换
      if (goal > 0.5 !== now.dark) { now.dark = goal > 0.5; resolve() }
      if (Math.abs(now.night - now.painted) > 0.004) paint()
      sun.target.position.copy(focus)
      sun.position.set(focus.x - 28, focus.y + 42, focus.z + 22)
      air.update(dt, time, focus, now)
      heaven.update(dt, camera, now)
    },
    repaint() { now.painted = -1 },
  }
}
