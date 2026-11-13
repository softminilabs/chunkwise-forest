// 树和地上的零碎。树都用实例化画：七八百棵只要几次绘制。换季时只改每棵树的颜色和阔叶树冠的大小（冬天叶子掉了）
import * as THREE from 'three'
import { mat, seeded, smooth } from '../look.js'
import { SPOTS } from './chests.js'
import { BOUNDS, CABINS, CLEARING, LODGE, STREAM, distanceTo, height, nearPath } from './land.js'

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

function treeSpots(random) {
  const spots = []
  while (spots.length < 760) {
    const x = random.between(-70, 70)
    const z = random.between(BOUNDS.north - 12, BOUNDS.south + 8)
    const path = nearPath(x, z)
    // 小路两边留出一条不种树的带子：镜头在人后面斜着往下看，路边有树会把人挡住
    if (path < 6.2 || distanceTo(STREAM, x, z) < 3 || Math.hypot(x - CLEARING.x, z - CLEARING.z) < 15 || Math.hypot(x - LODGE.x, z - LODGE.z) < 9) continue
    if (CABINS.some(cabin => Math.hypot(x - cabin.x, z - cabin.z) < 7.5)) continue
    // 宝箱藏在林子里，但不能种一棵树压在它身上
    if (Object.values(SPOTS).some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 2.6)) continue
    if (random.next() > 0.35 + smooth(6, 30, path) * 0.65) continue
    spots.push({ x, z, y: height(x, z), size: random.between(0.8, 1.35) * (0.8 + smooth(6, 34, path) * 0.7), pine: random.next() < 0.5, turn: random.next() * 6.28, hue: random.next(), pick: random.next() })
  }
  return spots
}

/// 一层实例：同一个几何体，画在每个点上。place 决定它相对树根放在哪、多大
function layer(scene, geometry, list, place) {
  const mesh = new THREE.InstancedMesh(geometry, mat('#ffffff'), list.length)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.lay = scale => list.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.y, spot.z)
    dummy.rotation.set(0, spot.turn, 0)
    dummy.scale.setScalar(spot.size)
    place(spot, dummy, scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.userData.lay(1)
  scene.add(mesh)
  return mesh
}

function litter(scene, random, look, season) {
  const group = new THREE.Group()
  const spread = (geometry, count, colors, place) => {
    const mesh = new THREE.InstancedMesh(geometry, mat('#ffffff'), count)
    for (let i = 0; i < count; i++) {
      let x = 0
      let z = 0
      do { x = random.between(-46, 46); z = random.between(BOUNDS.north, BOUNDS.south) } while (nearPath(x, z) < 1.7 || distanceTo(STREAM, x, z) < 1.8 || Math.hypot(x - CLEARING.x, z - CLEARING.z) < 4.5)
      dummy.position.set(x, height(x, z), z)
      dummy.rotation.set(0, random.next() * 6.28, 0)
      dummy.scale.setScalar(1)
      place(dummy)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tint.set(random.pick(colors)))
    }
    mesh.receiveShadow = true
    group.add(mesh)
  }
  spread(new THREE.IcosahedronGeometry(0.55, 1), 120, season === 'winter' ? ['#E8F0F4', '#DCE7EC'] : [look.pine, look.leaf[0]], node => { node.scale.set(random.between(0.8, 1.5), random.between(0.6, 0.9), random.between(0.8, 1.5)); node.position.y += 0.25 })
  spread(new THREE.IcosahedronGeometry(0.4, 0), 80, ['#9A9892', '#86847F', '#A7A6A0'], node => { node.scale.set(random.between(0.7, 1.8), random.between(0.5, 1), random.between(0.7, 1.5)); node.position.y += 0.12 })
  const leaf = new THREE.CircleGeometry(0.2, 5)
  leaf.rotateX(-Math.PI / 2)
  if (season === 'autumn') spread(leaf, 700, look.leaf, node => { node.position.y += 0.05; node.scale.setScalar(random.between(0.7, 1.4)) })
  if (season === 'spring') spread(new THREE.ConeGeometry(0.13, 0.26, 5), 520, ['#F7A9C4', '#FFFFFF', '#F6D35B', '#C9A7F0'], node => { node.position.y += 0.2 })
  if (season === 'summer') spread(new THREE.ConeGeometry(0.1, 0.22, 5), 240, ['#FFFFFF', '#F6D35B'], node => { node.position.y += 0.18 })
  scene.add(group)
  return group
}

export function createWoods(scene, colliders) {
  const spots = treeSpots(seeded(20261113))
  const pines = spots.filter(spot => spot.pine)
  const leafy = spots.filter(spot => !spot.pine)
  for (const spot of spots) colliders.push({ x: spot.x, z: spot.z, r: 0.35 * spot.size })
  const pineTrunks = layer(scene, new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), pines, (spot, node) => { node.position.y += 0.8 * spot.size })
  const leafTrunks = layer(scene, new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), leafy, (spot, node) => { node.position.y += 1.2 * spot.size })
  // 松树三层，越往上越小；后面那个数是冬天这一层有多白
  const tiers = [[1.5, 2.2, 1.9, 0.12], [1.15, 1.9, 3.1, 0.45], [0.8, 1.7, 4.2, 0.85]].map(([radius, tall, y, frost]) => ({ frost, mesh: layer(scene, new THREE.ConeGeometry(radius, tall, 7), pines, (spot, node) => { node.position.y += y * spot.size }) }))
  const crowns = [
    layer(scene, new THREE.IcosahedronGeometry(1.5, 1), leafy, (spot, node, scale) => { node.position.y += 3.2 * spot.size; node.scale.multiplyScalar(scale); node.scale.y *= 0.85 }),
    layer(scene, new THREE.IcosahedronGeometry(1.0, 1), leafy, (spot, node, scale) => { node.position.x += 0.9 * spot.size; node.position.y += 2.5 * spot.size; node.scale.multiplyScalar(scale) }),
  ]
  const snow = new THREE.Color('#F4F8FA')
  const pine = new THREE.Color()
  let scraps = null
  return {
    paint(look, season) {
      const winter = season === 'winter'
      const bark = tint.set(winter ? '#6B5A50' : '#7A5C46').clone()
      pines.forEach((_, i) => pineTrunks.setColorAt(i, bark))
      leafy.forEach((_, i) => leafTrunks.setColorAt(i, bark))
      pine.set(look.pine)
      for (const tier of tiers) pines.forEach((spot, i) => tier.mesh.setColorAt(i, tint.copy(pine).offsetHSL(0, 0, (spot.hue - 0.5) * 0.06).lerp(snow, winter ? tier.frost : 0)))
      for (const crown of crowns) {
        crown.userData.lay(winter ? 0.42 : 1)
        leafy.forEach((spot, i) => crown.setColorAt(i, tint.set(look.leaf[Math.floor(spot.pick * look.leaf.length)]).offsetHSL(0, 0, (spot.hue - 0.5) * 0.05)))
        crown.instanceMatrix.needsUpdate = true
      }
      for (const mesh of [pineTrunks, leafTrunks, ...tiers.map(tier => tier.mesh), ...crowns]) mesh.instanceColor.needsUpdate = true
      if (scraps) { scene.remove(scraps); scraps.traverse(node => node.geometry?.dispose()) }
      scraps = litter(scene, seeded(7), look, season)
    },
  }
}
