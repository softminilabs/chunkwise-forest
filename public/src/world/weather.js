// 天色和天气。季节默认跟着真实的日子、昼夜默认跟着真实的时间，都可以在「森林」面板里改成固定的。
// 这里管：光、雾、天空的颜色，还有飘着的东西——雨、雪、花瓣、落叶、萤火虫、星星、流星
import * as THREE from 'three'
import { LOOK, NIGHT_SKY, damp, points, seasonOf, seeded, smooth } from '../look.js'

const random = seeded(3)
const cloud = (count, make, material) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: count }, make).flat()), 3))
  const node = new THREE.Points(geometry, material)
  node.frustumCulled = false
  return node
}

/// 围着人飘的四样：雨、雪、花瓣或落叶、萤火虫。它们的盒子跟着人走，所以走到哪儿都在下
function createAir(scene) {
  const rainSpots = Array.from({ length: 520 }, () => ({ x: random.between(-42, 42), y: random.between(0, 26), z: random.between(-40, 30), speed: random.between(30, 40) }))
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rainSpots.length * 6), 3))
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 }))
  rain.frustumCulled = false
  const snow = cloud(700, () => [random.between(-44, 44), random.between(0, 22), random.between(-40, 30)], points({ color: '#FFFFFF', size: 0.34, opacity: 0.95 }))
  const drift = cloud(110, () => [random.between(-34, 34), random.between(0.2, 13), random.between(-30, 26)], points({ size: 0.4 }))
  const flies = cloud(46, () => [random.between(-24, 24), random.between(0.6, 3.6), random.between(-18, 14)], points({ color: '#E4F26A', size: 0.5, fog: false, blending: THREE.AdditiveBlending }))
  const homes = Float32Array.from(flies.geometry.attributes.position.array)
  const group = new THREE.Group()
  group.add(rain, snow, drift, flies)
  scene.add(group)
  const fall = (node, speed, sway, time, dt, top) => {
    const position = node.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      let y = position.getY(i) - speed * dt
      if (y < 0) y += top
      position.setY(i, y)
      position.setX(i, position.getX(i) + Math.sin(time * 0.8 + i) * sway * dt)
    }
    position.needsUpdate = true
  }
  return {
    update(dt, time, focus, scene) {
      group.position.set(focus.x, focus.y, focus.z)
      rain.visible = scene.weather === 'rain'
      snow.visible = scene.weather === 'snow' || (scene.season === 'winter' && scene.weather === 'clear')
      drift.visible = Boolean(LOOK[scene.season].drift) && scene.weather !== 'rain'
      flies.visible = scene.season === 'summer' && scene.night > 0.5 && scene.weather === 'clear'
      if (rain.visible) {
        const position = rainGeometry.attributes.position
        rainSpots.forEach((drop, i) => { drop.y -= drop.speed * dt; if (drop.y < 0) drop.y = 26; position.setXYZ(i * 2, drop.x, drop.y, drop.z); position.setXYZ(i * 2 + 1, drop.x - 0.25, drop.y + 1.2, drop.z) })
        position.needsUpdate = true
      }
      if (snow.visible) fall(snow, 2.4, 0.6, time, dt, 22)
      if (drift.visible) { drift.material.color.set(LOOK[scene.season].drift); fall(drift, 0.9, 1.1, time, dt, 13) }
      if (flies.visible) {
        const position = flies.geometry.attributes.position
        for (let i = 0; i < position.count; i++) position.setXYZ(i, homes[i * 3] + Math.sin(time * 0.5 + i) * 1.6, homes[i * 3 + 1] + Math.sin(time * 0.9 + i * 2) * 0.5, homes[i * 3 + 2] + Math.cos(time * 0.4 + i) * 1.6)
        position.needsUpdate = true
        flies.material.opacity = 0.6 + Math.sin(time * 3) * 0.3
      }
    },
  }
}

/// 天上的：星星一直在，夜里才显出来；流星隔几秒划一道
function createHeaven(scene) {
  const stars = cloud(420, () => { const a = random.next() * 6.28; const up = random.between(0.1, 1.2); return [Math.cos(a) * Math.cos(up) * 170, Math.sin(up) * 170, Math.sin(a) * Math.cos(up) * 170] }, points({ color: '#FFFFFF', size: 2.4, sizeAttenuation: false, fog: false, opacity: 0 }))
  const meteors = Array.from({ length: 3 }, () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0.05, 0.1, 0.2]), 3))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0 }))
    line.frustumCulled = false
    return { line, life: 0, x: 0, y: 0, long: 10 }
  })
  const group = new THREE.Group()
  group.add(stars, ...meteors.map(meteor => meteor.line))
  scene.add(group)
  let next = 1.5
  return {
    update(dt, camera, scene) {
      group.position.copy(camera.position)
      stars.material.opacity = scene.night * (scene.weather === 'clear' || scene.weather === 'meteor' ? 0.9 : 0.25)
      next -= dt
      if (scene.weather === 'meteor' && scene.night > 0.6 && next <= 0) {
        const idle = meteors.find(meteor => meteor.life <= 0)
        if (idle) Object.assign(idle, { life: 1, x: random.between(-70, 60), y: random.between(55, 95), long: random.between(9, 18) })
        next = random.between(1.2, 3.6)
      }
      for (const meteor of meteors) {
        if (meteor.life <= 0) { meteor.line.material.opacity = 0; continue }
        meteor.life -= dt * 1.3
        const run = (1 - meteor.life) * 46
        const position = meteor.line.geometry.attributes.position
        position.setXYZ(0, meteor.x - run, meteor.y - run * 0.45, -130)
        position.setXYZ(1, meteor.x - run + meteor.long, meteor.y - run * 0.45 + meteor.long * 0.45, -130)
        position.needsUpdate = true
        meteor.line.material.opacity = Math.sin(Math.max(0, meteor.life) * Math.PI)
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
  const now = { season: 'autumn', weather: 'clear', night: 0, painted: -1, paintedSeason: '' }
  const listeners = []
  const [top, low, mix] = [new THREE.Color(), new THREE.Color(), new THREE.Color()]

  /// 按「森林」面板里的选择定下现在是什么季节、什么天气；季节变了就通知地面、树、木屋重新上色
  function resolve() {
    const wish = state.town.scene
    const season = wish.season === 'auto' ? seasonOf() : wish.season
    now.weather = wish.weather
    if (season === now.season && now.paintedSeason) return
    now.season = season
    now.paintedSeason = season
    now.painted = -1
    for (const listener of listeners) listener(LOOK[season], season)
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
    const gloom = now.weather === 'rain' ? 0.25 : 0
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
    onSeason(listener) { listeners.push(listener) },
    resolve,
    update(dt, time, focus, camera) {
      now.night = damp(now.night, nightGoal(), 1.6, dt)
      if (Math.abs(now.night - now.painted) > 0.004) paint()
      sun.target.position.copy(focus)
      sun.position.set(focus.x - 28, focus.y + 42, focus.z + 22)
      air.update(dt, time, focus, now)
      heaven.update(dt, camera, now)
    },
    repaint() { now.painted = -1 },
  }
}
