// 地形和路。一条小路从南边的入口穿过林间空地，一直往北蜿蜒进森林深处，九间木屋一左一右挨着它；
// 越往里走课越靠后。东边有一条小溪
import * as THREE from 'three'
import { mat, smooth } from '../look.js'

export const CLEARING = { x: 0, z: 5 }
export const LODGE = { x: 14.5, z: 1 }
// 讲堂：钟楼脚下的位置，屋身从这儿往西伸。在空地西边、单词屋对面，但比单词屋离篝火远一截：
// 从开场的镜头看过去，整座屋要落在灯笼树和第 1 间木屋的左边，再靠近就和它们叠在一起了
export const HALL = { x: -16.9, z: 4.1 }
export const BOUNDS = { x: 56, north: -122, south: 50 }
const TRAIL = [[0, 52], [1, 32], [-1, 17], [0, 6], [-3, -5], [3, -19], [-3, -34], [4, -50], [-3, -66], [3, -82], [-2, -98], [0, -116]]
export const STREAM = [[40, -126], [30, -92], [35, -62], [28, -32], [25, -8], [21, 12], [23, 32], [30, 58]]

/// 小路在某个 z 上的 x
export function trailX(z) {
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i]
    const [bx, bz] = TRAIL[i + 1]
    if (z <= az && z >= bz) return ax + (bx - ax) * (az - z) / (az - bz)
  }
  return 0
}
// 九间木屋：一左一右，每间朝着小路
export const CABINS = Array.from({ length: 9 }, (_, k) => {
  const z = -9 - k * 11.5
  const side = k % 2 ? 1 : -1
  return { x: trailX(z) + side * 12.5, z, side }
})
const SPURS = [...CABINS.map(cabin => [[trailX(cabin.z), cabin.z], [cabin.x - cabin.side * 3.4, cabin.z]]), [[0, 6], [LODGE.x - 4, LODGE.z + 1.5]]]
// 从空地通到讲堂台阶前的小路：只用来给地面上色、画地图。不能并进 SPURS：
// 地势、种树、种植位置都按 SPURS 算，多一条整片林子就挪位了
export const HALL_WALK = [[0, 6], [HALL.x + 2.3, HALL.z + 0.5]]

export function distanceTo(line, x, z) {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i]
    const [bx, bz] = line[i + 1]
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)))
    best = Math.min(best, Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t))
  }
  return best
}
export function nearPath(x, z) {
  let best = distanceTo(TRAIL, x, z)
  for (const spur of SPURS) best = Math.min(best, distanceTo(spur, x, z))
  return best
}

/// 地势：空地和小路是平的，离路远了有缓坡，世界的边上抬成一圈小山，溪水那一道压低
export function height(x, z) {
  const rough = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 1.5 + Math.sin(x * 0.29 + z * 0.17) * 0.5
  const open = smooth(13, 30, Math.hypot(x - CLEARING.x, z - CLEARING.z)) * smooth(2.5, 11, nearPath(x, z))
  const rim = Math.max(0, Math.abs(x) - 44) * 0.28 + Math.max(0, BOUNDS.north + 8 - z) * 0.3 + Math.max(0, z - 44) * 0.25
  return rough * open + rim - smooth(2.4, 0.2, distanceTo(STREAM, x, z)) * 0.9
}

/// 溪水：沿着折线铺一条带子，浮在压低的河道里
function water() {
  const curve = new THREE.CatmullRomCurve3(STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z)))
  const steps = 120
  const position = []
  const index = []
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPoint(i / steps)
    const t = curve.getTangent(i / steps)
    const y = height(p.x, p.z) + 0.45
    position.push(p.x - t.z * 1.5, y, p.z + t.x * 1.5, p.x + t.z * 1.5, y, p.z - t.x * 1.5)
    if (i < steps) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#A6C9CD', roughness: 0.35, transparent: true, opacity: 0.86 }))
  mesh.receiveShadow = true
  return mesh
}

export function createLand(scene) {
  const geometry = new THREE.PlaneGeometry(150, 204, 84, 114)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, 0, -36)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) position.setY(i, height(position.getX(i), position.getZ(i)))
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3), 3))
  geometry.computeVertexNormals()
  const ground = new THREE.Mesh(geometry, mat('#ffffff', { vertexColors: true }))
  ground.receiveShadow = true
  const stream = water()
  scene.add(ground, stream)
  const [a, b, path, color] = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()]
  return {
    /// 换季：地面按新的颜色重新上一遍色
    paint(look) {
      a.set(look.ground[0]); b.set(look.ground[1]); path.set(look.path)
      const colors = geometry.attributes.color
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i)
        const z = position.getZ(i)
        color.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.4 + Math.cos(z * 0.33) * 2))
        color.lerp(path, smooth(2.1, 0.9, Math.min(nearPath(x, z), distanceTo(HALL_WALK, x, z))) * 0.9).lerp(path, smooth(9.5, 5.5, Math.hypot(x - CLEARING.x, z - CLEARING.z)) * 0.55)
        colors.setXYZ(i, color.r, color.g, color.b)
      }
      colors.needsUpdate = true
      stream.material.color.set(look.water)
    },
  }
}
