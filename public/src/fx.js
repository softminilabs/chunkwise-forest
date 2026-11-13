// 小庆祝：一把彩色小球从某个地方迸出来，落下去消失；还有点地面时落点冒的那个圈
import * as THREE from 'three'

const COLORS = ['#FFD27A', '#3F6B55', '#FBF8F1', '#E0A63A', '#FFF0B8']
const glow = color => new THREE.MeshBasicMaterial({ color, fog: false })

export function createFx(scene) {
  const geometry = new THREE.SphereGeometry(0.16, 8, 6)
  const pool = Array.from({ length: 60 }, (_, k) => {
    const mesh = new THREE.Mesh(geometry, glow(COLORS[k % COLORS.length]))
    mesh.visible = false
    scene.add(mesh)
    return { mesh, velocity: new THREE.Vector3(), life: 0, floor: 0 }
  })
  let cursor = 0
  // 点地面时落点冒一个圈：让人知道点到哪儿了、小陈要往哪走
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 32), new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, fog: false, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  scene.add(ring)
  let pinged = 0
  return {
    ping(x, y, z) { ring.position.set(x, y + 0.12, z); ring.visible = true; pinged = 1 },
    burst(x, y, z, count = 16, power = 1) {
      for (let k = 0; k < count; k++) {
        const bit = pool[cursor = (cursor + 1) % pool.length]
        const angle = Math.random() * Math.PI * 2
        bit.mesh.position.set(x, y, z)
        bit.mesh.visible = true
        bit.velocity.set(Math.cos(angle) * (1.5 + Math.random() * 3) * power, (4 + Math.random() * 5) * power, Math.sin(angle) * (1.5 + Math.random() * 3) * power)
        bit.life = 0.9 + Math.random() * 0.5
        bit.floor = y - 4
      }
    },
    update(dt) {
      if (pinged > 0) {
        pinged -= dt * 2.4
        ring.scale.setScalar(1.9 - pinged * 1.3)
        ring.material.opacity = Math.max(0, pinged)
        ring.visible = pinged > 0
      }
      for (const bit of pool) {
        if (bit.life <= 0) continue
        bit.life -= dt
        bit.velocity.y -= 16 * dt
        bit.mesh.position.addScaledVector(bit.velocity, dt)
        bit.mesh.scale.setScalar(Math.max(0.01, Math.min(1, bit.life * 2)))
        if (bit.life <= 0 || bit.mesh.position.y < bit.floor) { bit.life = 0; bit.mesh.visible = false }
      }
    },
  }
}
