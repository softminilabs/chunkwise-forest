// 林间空地中间的篝火。点着了有火光、火星和噼啪声（声音在 sounds.js 里按离火堆多远算音量）
import * as THREE from 'three'
import { at, mat, points, seeded, shade } from '../look.js'
import { CLEARING, height } from './land.js'

export function createCamp(scene, colliders) {
  const random = seeded(11)
  const camp = new THREE.Group()
  for (let k = 0; k < 9; k++) camp.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(random.between(0.22, 0.34), 0), mat('#8F8D88')), Math.cos(k * 0.7) * 1.05, 0.14, Math.sin(k * 0.7) * 1.05)))
  for (const turn of [0.4, 1.5, 2.6]) { const log = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 6), mat('#6A4B37'))); log.rotation.set(Math.PI / 2 - 0.35, turn, 0); camp.add(at(log, 0, 0.32, 0)) }
  for (const [x, z, turn] of [[-3.1, 1.2, 0.5], [3, 1.4, -0.4], [0.2, 3.4, 1.57]]) { const seat = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.4, 8), mat('#8B6648'))); seat.rotation.set(0, turn, Math.PI / 2); camp.add(at(seat, x, 0.42, z)) }
  const flame = (radius, tall, color, y) => at(new THREE.Mesh(new THREE.ConeGeometry(radius, tall, 5), new THREE.MeshBasicMaterial({ color, fog: false })), 0, y, 0)
  const flames = [flame(0.5, 1.5, '#FF8A2B', 0.95), flame(0.32, 1.1, '#FFC24A', 0.85), flame(0.16, 0.7, '#FFF0B8', 0.75)]
  const glow = at(new THREE.PointLight('#FF9A45', 0, 46, 2), 0, 1.5, 0)
  const sparks = new THREE.BufferGeometry()
  const rise = Array.from({ length: 14 }, () => ({ x: random.between(-0.6, 0.6), z: random.between(-0.6, 0.6), speed: random.between(0.5, 1.1), offset: random.next() }))
  sparks.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rise.length * 3), 3))
  const embers = new THREE.Points(sparks, points({ color: '#FFC56A', size: 0.2, fog: false, blending: THREE.AdditiveBlending }))
  camp.add(...flames, glow, embers)
  camp.position.set(CLEARING.x, height(CLEARING.x, CLEARING.z), CLEARING.z)
  scene.add(camp)
  colliders.push({ x: CLEARING.x, z: CLEARING.z, r: 1.2 })
  const state = { x: CLEARING.x, z: CLEARING.z, y: camp.position.y, lit: false, heat: 0 }
  return {
    state,
    light(on) { state.lit = on },
    update(dt, time, night, raining) {
      // 雨里火留不住；雪天照样能烧
      if (raining) state.lit = false
      state.heat += ((state.lit ? 1 : 0) - state.heat) * Math.min(1, dt * 2.5)
      const flicker = 0.85 + Math.sin(time * 11) * 0.08 + Math.sin(time * 23.7) * 0.07
      flames.forEach((cone, k) => { cone.visible = state.heat > 0.03; cone.scale.set(state.heat, state.heat * (flicker + k * 0.06), state.heat) })
      // 白天也看得见火，但只有夜里它才照得亮四周
      glow.intensity = state.heat * flicker * (40 + night * 150)
      embers.visible = state.heat > 0.3
      const position = sparks.attributes.position
      rise.forEach((spark, i) => { const t = (time * spark.speed * 0.35 + spark.offset) % 1; position.setXYZ(i, spark.x * (1 + t), 1.2 + t * 3.6, spark.z * (1 + t)) })
      position.needsUpdate = true
    },
  }
}
