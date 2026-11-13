// 开场位置左手边的一棵树。平时是一棵普通的阔叶树；冬天叶子落了，枝头挂上六只大红灯笼，
// 点它看离春节还有几天（ui/countdown.js）。和右手边的圣诞树一左一右
import * as THREE from 'three'
import { at, mat, shade } from '../look.js'
import { height } from './land.js'

// 这个位置七米之内没有别的树。从开场的镜头看过去，原来有两棵松树挡在它前面，在 woods.js 的 CLEARED 里拿掉了
export const LANTERN_TREE = { x: -6, z: 22.5 }
// 六根枝：[从树干多高的地方分出去, 朝哪个方向, 多长, 往上翘多少（弧度，0 是平伸）]
const BRANCHES = [[2.5, 0.3, 2.5, 0.5], [2.9, 2.2, 2.3, 0.6], [3.2, 4.1, 2.4, 0.55], [3.7, 1.2, 2.0, 0.75], [4.0, 3.2, 1.9, 0.8], [4.3, 5.3, 1.8, 0.85]]
const SNOW = '#F4F8FA'

/// 两点之间的一根枝：下粗上细
function limb(from, to, thick, thin, material) {
  const mesh = shade(new THREE.Mesh(new THREE.CylinderGeometry(thin, thick, from.distanceTo(to), 6), material))
  mesh.position.copy(from).lerp(to, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
  return mesh
}

/// 一只大红灯笼，挂点在原点，往下垂：一根绳、金色的上下盖、红肚子、底下一条穗子
function lantern(red, gold, cord) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), red)
  body.scale.y = 0.84
  group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), cord), 0, -0.2, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.1, 12), gold), 0, -0.44, 0),
    shade(at(body, 0, -0.88, 0)),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.1, 12), gold), 0, -1.32, 0),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.55, 6), gold), 0, -1.64, 0))
  return group
}

/// 枝干：一根树干加六根枝。返回每根枝的枝头在哪儿（灯笼挂那儿）
function skeleton(root, bark) {
  root.add(shade(at(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 4.6, 7), bark), 0, 2.3, 0)))
  return BRANCHES.map(([up, turn, long, lift]) => {
    const from = new THREE.Vector3(0, up, 0)
    const tip = new THREE.Vector3(Math.cos(turn) * Math.cos(lift) * long, up + Math.sin(lift) * long, Math.sin(turn) * Math.cos(lift) * long)
    root.add(limb(from, tip, 0.13, 0.05, bark))
    return tip
  })
}

export function createLanternTree(scene, colliders) {
  const root = new THREE.Group()
  const bark = mat('#7A5C46')
  const leaf = mat('#6FBA63')
  const red = new THREE.MeshStandardMaterial({ color: '#C8372D', emissive: '#E8423E', emissiveIntensity: 0.3, roughness: 0.55, flatShading: true })
  const tips = skeleton(root, bark)
  // 不是冬天的时候：枝头各一团叶子，顶上一大团
  const crown = new THREE.Group()
  for (const tip of tips) crown.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), leaf), tip.x * 0.9, tip.y + 0.3, tip.z * 0.9)))
  crown.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), leaf), 0, 5.3, 0)))
  // 冬天：枝头压一小团雪，底下挂灯笼
  const winter = new THREE.Group()
  const hung = tips.map(tip => at(lantern(red, mat('#D9A531'), mat('#4A3A30')), tip.x * 0.92, tip.y - 0.04, tip.z * 0.92))
  for (const tip of tips) { const pad = at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), mat(SNOW)), tip.x, tip.y + 0.08, tip.z); pad.scale.y = 0.55; winter.add(pad) }
  // 暖光放在树前面，离灯笼远一点：贴着放会在灯笼上烧出一块白
  // 灯笼照出来的是淡红色的光，不是橙色
  const glow = at(new THREE.PointLight('#FF9C9C', 0, 15, 2), 0, 2.6, 3.8)
  winter.add(...hung, glow)
  root.add(crown, winter)
  root.position.set(LANTERN_TREE.x, height(LANTERN_TREE.x, LANTERN_TREE.z), LANTERN_TREE.z)
  scene.add(root)
  colliders.push({ x: LANTERN_TREE.x, z: LANTERN_TREE.z, r: 0.7 })

  return {
    position: root.position,
    paint(look, season) {
      winter.visible = season === 'winter'
      crown.visible = !winter.visible
      bark.color.set(winter.visible ? '#6B5A50' : '#7A5C46')
      leaf.color.set(look.leaf[0])
    },
    update(night, time) {
      if (!winter.visible) return
      // 亮得太狠灯笼会发白，看不出是红的
      red.emissiveIntensity = 0.3 + night * 0.75
      glow.intensity = night * 10
      // 灯笼在风里轻轻晃
      hung.forEach((item, k) => { item.rotation.z = Math.sin(time * 1.1 + k * 1.7) * 0.07 })
    },
  }
}
