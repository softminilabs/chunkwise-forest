// 天色跟着真实时间走（岁时 Sundial 的点子：把时间放在看得见的地方）：太阳的方向、影子、天空、灯光的明暗都由它定
import * as THREE from 'three'
import { C, SKY } from '../palette.js'
import { tintFlats, tintOutlines } from '../toy.js'

const smooth = (edge0, edge1, x) => { const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }
const mix3 = (key, dayness, dusk, out) => out.set(SKY.night[key]).lerp(new THREE.Color(SKY.day[key]), dayness).lerp(new THREE.Color(SKY.dusk[key]), dusk)

export function createSky(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 1.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 10, far: 160 })
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.03
  sun.shadow.radius = 3
  const hemi = new THREE.HemisphereLight(0xffffff, 0xebd9ff, 1.6)
  scene.add(sun, sun.target, hemi)
  scene.background = new THREE.Color(SKY.day.sky)

  const shadowFloor = new THREE.ShadowMaterial({ color: C.shade, opacity: 0.26 })
  const scratch = new THREE.Color()
  const state = { hour: 12, override: null, night: 0, applied: -1, shadowFloor }

  function apply(hour) {
    const angle = (hour - 6) / 12 * Math.PI
    const elevation = Math.sin(angle)
    const dayness = smooth(-0.18, 0.32, elevation)
    const dusk = (1 - Math.abs(dayness * 2 - 1)) * 0.75
    state.night = 1 - dayness
    // 太阳落到地平线下就换成月亮从另一边照，不然夜里没有影子，东西像飘着
    const lightAngle = elevation >= 0 ? angle : angle - Math.PI
    sun.userData.direction = new THREE.Vector3(-Math.cos(lightAngle) * 0.9, Math.max(Math.abs(elevation), 0.34), 0.45).normalize()
    sun.intensity = 0.62 + dayness * 0.88
    hemi.intensity = 1.3 + dayness * 0.35
    mix3('sun', dayness, dusk, sun.color)
    mix3('ground', dayness, dusk, hemi.groundColor)
    mix3('sky', dayness, dusk, scene.background)
    tintFlats(mix3('flat', dayness, dusk, scratch))
    tintOutlines(mix3('outline', dayness, dusk, scratch))
    // 日出日落那一刻光源换边，影子会突然翻面：趁那会儿把影子淡掉
    shadowFloor.opacity = (0.14 + dayness * 0.14) * smooth(0.02, 0.22, Math.abs(elevation))
  }

  function update(focus) {
    const now = new Date()
    state.hour = state.override ?? now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
    if (Math.abs(state.hour - state.applied) > 0.004) { apply(state.hour); state.applied = state.hour }
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(sun.userData.direction, 70)
  }

  return { state, update, sun, setHour(hour) { state.override = hour } }
}
