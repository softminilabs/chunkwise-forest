// 开场位置右手边的一棵松树。平时就是一棵松树；冬天给它压上雪、挂上彩球和串灯、顶上一颗星、脚下几只礼物盒，
// 点它看离圣诞节还有几天（ui/countdown.js）
import * as THREE from 'three'
import { at, mat, shade } from '../look.js'
import { height } from './land.js'

// 这个位置四米之内没有别的树、宝箱（量过）。树林是按固定的随机数种的，不能为了它去改种树的规则，一改整片林子都会挪位
export const XMAS = { x: 6.5, z: 18.5 }
// 四层：[底半径, 高, 中心离地多高]
const TIERS = [[2.1, 2.3, 1.95], [1.7, 2.1, 3.2], [1.3, 1.9, 4.4], [0.9, 1.7, 5.5]]
const BAUBLES = ['#C8372D', '#E9B949', '#F4F1EA', '#4E7FA8']
const SNOW = '#F4F8FA'

function starGeometry(outer, inner, depth) {
  const shape = new THREE.Shape()
  for (let k = 0; k < 10; k++) {
    const radius = k % 2 ? inner : outer
    const angle = Math.PI / 2 + k * Math.PI / 5
    shape[k ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2)
}

/// 绕着每一层树冠摆一圈小球。up：摆在这一层多高的地方（0 是层底，1 是层尖）；out：比树冠表面再往外多少
function ring(count, up, out, turn) {
  const spots = []
  TIERS.forEach(([radius, tall, y], tier) => {
    const n = count - tier
    for (let i = 0; i < n; i++) {
      const angle = turn + tier * 0.7 + i / n * Math.PI * 2
      const reach = radius * (1 - up) + out
      spots.push(new THREE.Vector3(Math.cos(angle) * reach, y - tall / 2 + tall * up, Math.sin(angle) * reach))
    }
  })
  return spots
}

function instances(geometry, material, spots) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
  const dummy = new THREE.Object3D()
  spots.forEach((spot, i) => { dummy.position.copy(spot); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix) })
  return mesh
}

function gift(wide, tall, deep, box, ribbon) {
  const group = new THREE.Group()
  group.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(wide, tall, deep), mat(box)), 0, tall / 2, 0)))
  group.add(at(new THREE.Mesh(new THREE.BoxGeometry(wide + 0.02, tall + 0.02, deep * 0.2), mat(ribbon)), 0, tall / 2, 0))
  group.add(at(new THREE.Mesh(new THREE.BoxGeometry(wide * 0.2, tall + 0.02, deep + 0.02), mat(ribbon)), 0, tall / 2, 0))
  return group
}

/// 只有冬天才有的那些：星、彩球、串灯、礼物盒、夜里的一点暖光
function decorations() {
  const group = new THREE.Group()
  const star = at(new THREE.Mesh(starGeometry(0.5, 0.21, 0.14), new THREE.MeshStandardMaterial({ color: '#F2C24A', emissive: '#FFB52E', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })), 0, 6.72, 0)
  const baubles = instances(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25 }), ring(7, 0.16, 0.04, 0.3))
  const tint = new THREE.Color()
  for (let i = 0; i < baubles.count; i++) baubles.setColorAt(i, tint.set(BAUBLES[i % BAUBLES.length]))
  // 串灯自己发光（不吃场景里的光），每一颗的亮度每帧单独调，才一闪一闪
  const lights = instances(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial(), ring(8, 0.5, 0.03, 0.9))
  // 暖光放在树前面两三米、离树远一点：贴着树放的话，树冠上会烧出一块白
  const glow = at(new THREE.PointLight('#FFCF8A', 0, 14, 2), 0, 2.4, 3.6)
  // 礼物盒摆在朝南（朝开场镜头）的这一侧：[宽, 高, 深, 盒子色, 丝带色, x, z, 转多少]
  const gifts = [[0.8, 0.55, 0.65, '#B8332B', '#F4F1EA', -1.25, 1.55, 0.4], [0.6, 0.42, 0.55, '#F4F1EA', '#B8332B', 0.2, 2.05, 0], [0.62, 0.7, 0.5, '#3F6B55', '#E9B949', 1.3, 1.4, -0.5]].map(([wide, tall, deep, box, ribbon, x, z, turn]) => {
    const node = at(gift(wide, tall, deep, box, ribbon), x, 0, z)
    node.rotation.y = turn
    return node
  })
  group.add(star, baubles, lights, glow, ...gifts)
  return { group, star, lights, glow, tint }
}

export function createXmas(scene, colliders) {
  const root = new THREE.Group()
  const green = mat('#3F685A')
  root.add(shade(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6), mat('#6B5A50')), 0, 0.8, 0)))
  for (const [radius, tall, y] of TIERS) root.add(shade(at(new THREE.Mesh(new THREE.ConeGeometry(radius, tall, 8), green), 0, y, 0)))
  // 每层树冠的上半截压着雪：一个白锥套在尖上，比树冠表面鼓出来一点点（一样大的话会和树冠贴在一起，看不见）
  const caps = TIERS.map(([radius, tall, y]) => at(new THREE.Mesh(new THREE.ConeGeometry(radius * 0.56, tall * 0.5, 8), mat(SNOW)), 0, y + tall * 0.265, 0))
  const decor = decorations()
  root.add(...caps, decor.group)
  root.position.set(XMAS.x, height(XMAS.x, XMAS.z), XMAS.z)
  scene.add(root)
  colliders.push({ x: XMAS.x, z: XMAS.z, r: 1 })
  let winter = false

  return {
    position: root.position,
    paint(look, season) {
      winter = season === 'winter'
      green.color.set(look.pine)
      for (const cap of caps) cap.visible = winter
      decor.group.visible = winter
    },
    update(night, time) {
      if (!winter) return
      decor.star.rotation.y = Math.sin(time * 0.8) * 0.5
      decor.star.material.emissiveIntensity = 0.6 + night * 1.8
      decor.glow.intensity = night * 9
      for (let i = 0; i < decor.lights.count; i++) decor.lights.setColorAt(i, decor.tint.set('#FFD98A').multiplyScalar((0.55 + 0.45 * Math.sin(time * 2.6 + i * 1.9)) * (0.7 + night * 0.8)))
      decor.lights.instanceColor.needsUpdate = true
    },
  }
}
