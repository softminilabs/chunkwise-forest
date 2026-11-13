// 广场上的扭蛋机 = 练习场的入口。里面的小球就是收来的卡片
import { C } from '../palette.js'
import { at, ball, box, canvasTexture, drum, group, toy } from '../toy.js'
import * as THREE from 'three'

export function createArcade(scene, colliders, x, z) {
  const sign = canvasTexture(384, 128, (context, width, height) => {
    context.fillStyle = C.lime
    context.fillRect(0, 0, width, height)
    context.fillStyle = C.ink
    context.font = '800 78px "Yuanti SC", "PingFang SC", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('练习场', width / 2, height / 2 + 4)
  })
  const colors = [C.lime, C.violet, C.white, C.ink, C.lilac, C.lime, C.white, C.violet, C.lime, C.lilac, C.ink]
  const spots = [[-0.6, 0, 0.4], [0.55, 0, 0.45], [0, 0, -0.5], [-0.5, 0.05, -0.35], [0.6, 0.05, -0.3], [0, 0.1, 0.15], [-0.3, 0.75, 0.1], [0.35, 0.78, 0.1], [0, 0.72, -0.4], [0.02, 0.95, 0.35], [0, 1.4, 0]]
  const capsules = spots.map(([cx, cy, cz], k) => at(toy(ball(0.42), colors[k], { outline: 0.07 }), cx, 2.75 + cy, cz))
  const knob = at(toy(drum(0.3, 0.3, 0.22, 0.08, 20), C.ink, { outline: 0.07 }), 0.55, 1.25, 1.12)
  knob.rotation.x = Math.PI / 2
  const root = group(
    toy(drum(1.25, 1.4, 2.2, 0.3), C.violet, { outline: 0.13 }),
    at(toy(drum(1.5, 1.3, 0.4, 0.14), C.white, { outline: 0.12 }), 0, 2.15, 0),
    ...capsules, knob,
    at(toy(box(0.9, 0.5, 0.3, 0.14), C.ink, { outline: 0.08 }), -0.45, 0.55, 1.2),
    at(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: sign })), 0, 1.72, 1.36))
  root.position.set(x, 0, z)
  root.rotation.y = Math.atan2(-x, -z) + Math.PI
  scene.add(root)
  colliders.push({ x, z, r: 1.6 })
  return {
    x, z, height: 4.6,
    update(time) { capsules.forEach((capsule, k) => { capsule.position.y = 2.75 + spots[k][1] + Math.sin(time * 2.4 + k * 1.7) * 0.05 }); knob.rotation.z = Math.sin(time * 1.3) * 0.5 },
  }
}
