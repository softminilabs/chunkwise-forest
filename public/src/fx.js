// 小庆祝：一把彩色小球从某个地方迸出来，落下去消失
import * as THREE from 'three'
import { C } from './palette.js'
import { flat } from './toy.js'

const COLORS = [C.lime, C.violet, C.white, C.ink, C.glow]

export function createFx(scene) {
  const geometry = new THREE.SphereGeometry(0.16, 8, 6)
  const pool = Array.from({ length: 60 }, (_, k) => {
    const mesh = new THREE.Mesh(geometry, flat(COLORS[k % COLORS.length], { glow: true }))
    mesh.visible = false
    scene.add(mesh)
    return { mesh, velocity: new THREE.Vector3(), life: 0 }
  })
  let cursor = 0
  return {
    burst(x, y, z, count = 16, power = 1) {
      for (let k = 0; k < count; k++) {
        const bit = pool[cursor = (cursor + 1) % pool.length]
        const angle = Math.random() * Math.PI * 2
        bit.mesh.position.set(x, y, z)
        bit.mesh.visible = true
        bit.velocity.set(Math.cos(angle) * (1.5 + Math.random() * 3) * power, (4 + Math.random() * 5) * power, Math.sin(angle) * (1.5 + Math.random() * 3) * power)
        bit.life = 0.9 + Math.random() * 0.5
      }
    },
    update(dt) {
      for (const bit of pool) {
        if (bit.life <= 0) continue
        bit.life -= dt
        bit.velocity.y -= 16 * dt
        bit.mesh.position.addScaledVector(bit.velocity, dt)
        bit.mesh.scale.setScalar(Math.max(0.01, Math.min(1, bit.life * 2)))
        if (bit.life <= 0 || bit.mesh.position.y < 0) { bit.life = 0; bit.mesh.visible = false }
      }
    },
  }
}
