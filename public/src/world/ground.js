// 小岛本身：一块浮在奶粉色天上的圆地，中间是广场，一圈环路把九栋房子串起来
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, ball, drum, flat, group, polar, toy } from '../toy.js'

export const ISLAND = 36
export const PLAZA = 9
export const RING = 18
export const HOUSE_RING = 26
// 九栋房子排成一个朝南开口的马蹄形：南边留空，从入口望进去不被房子背面挡住
export const houseAngle = index => (index - 4) * 36

function lay(geometry, color, y) {
  const mesh = new THREE.Mesh(geometry, flat(color))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  return mesh
}

/// 从圆心往外的一段直路
function spoke(degrees, from, to, width) {
  const road = lay(new THREE.PlaneGeometry(width, to - from), C.cream, 0.03)
  road.position.z = -(from + to) / 2
  const holder = group(road)
  holder.rotation.y = -degrees * Math.PI / 180
  return holder
}

function islandBody() {
  const profile = [[0, -11], [9, -10], [20, -7.4], [29, -4.4], [34.4, -1.8], [ISLAND + 0.3, -0.5], [ISLAND + 0.3, -0.05]].map(([x, y]) => new THREE.Vector2(x, y))
  const body = toy(new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(28), 72), C.violet, { outline: 0.3, cast: false })
  return body
}

function cloud(size, color) {
  const puff = (radius, x, y, z) => at(toy(ball(radius * size, 0.82), color, { outline: 0.2 * size, cast: false }), x * size, y * size, z * size)
  return group(puff(2.4, 0, 0, 0), puff(1.8, 2.5, -0.3, 0.2), puff(1.6, -2.4, -0.4, 0.1), puff(1.3, 1.0, 0.9, -0.3))
}

function scatter(count, color, radius, taken) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 8, 6), flat(color), count)
  const matrix = new THREE.Matrix4()
  let placed = 0
  // 固定的随机序列：每次打开小镇，花都长在老地方
  let seed = Math.round(radius * 9973)
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  while (placed < count) {
    const r = PLAZA + 1 + random() * (ISLAND - PLAZA - 3)
    const a = random() * Math.PI * 2
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    if (Math.abs(r - RING) < 1.7 || taken(x, z)) continue
    matrix.makeTranslation(x, radius * 0.5, z)
    mesh.setMatrixAt(placed++, matrix)
  }
  return mesh
}

export function createGround(scene, sky) {
  const colliders = []
  const top = lay(new THREE.CircleGeometry(ISLAND, 96), C.lilacSoft, 0)
  const plaza = lay(new THREE.CircleGeometry(PLAZA, 64), C.cream, 0.03)
  const plazaLine = lay(new THREE.RingGeometry(PLAZA - 0.75, PLAZA - 0.5, 64), C.lilac, 0.04)
  const ring = lay(new THREE.RingGeometry(RING - 1.2, RING + 1.2, 96), C.cream, 0.03)
  const patches = [[-112, 30, 4.6], [-18, 30, 4], [75, 30, 4.4], [-90, 13.5, 3], [92, 13.5, 2.8]].map(([degrees, radius, size]) => {
    const { x, z } = polar(degrees, radius)
    return at(lay(new THREE.CircleGeometry(size, 40), C.patch, 0.015), x, 0.015, z)
  })
  scene.add(top, plaza, plazaLine, ring, ...patches, islandBody())
  scene.add(spoke(180, PLAZA - 0.2, 31, 2.4), spoke(-60, PLAZA - 0.2, RING, 2.2), spoke(60, PLAZA - 0.2, RING, 2.2))
  for (let i = 0; i < 9; i++) scene.add(spoke(houseAngle(i), RING, HOUSE_RING - 2.4, 1.8))

  const floor = new THREE.Mesh(new THREE.CircleGeometry(ISLAND, 64), sky.state.shadowFloor)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.06
  floor.receiveShadow = true
  scene.add(floor)

  const clouds = [[-48, -7, -18, 2.2, C.lilacPale], [44, -9, -30, 2.8, C.white], [10, -12, 46, 3.0, C.lilacPale], [-36, -10, 34, 2.0, C.white], [56, 6, 8, 1.6, C.white], [-58, 9, -40, 2.4, C.lilacSoft], [2, 10, -72, 3.4, C.lilacSoft], [40, 7, -62, 2.2, C.lilac], [-24, 5, -66, 1.8, C.white]]
    .map(([x, y, z, size, color]) => at(cloud(size, color), x, y, z))
  const drift = group(...clouds)
  scene.add(drift)

  const onPath = (x, z) => {
    const r = Math.hypot(x, z)
    const degrees = Math.atan2(x, -z) * 180 / Math.PI
    const near = target => Math.abs(((degrees - target + 540) % 360) - 180) * Math.PI / 180 * r < 1.8
    return near(180) || (r < RING && (near(-60) || near(60))) || (r > RING && r < HOUSE_RING + 4 && Array.from({ length: 9 }, (_, i) => houseAngle(i)).some(angle => Math.abs(((degrees - angle + 540) % 360) - 180) < 9))
  }
  // 花只在路两边 4 格以外长，而且不多：满地都是小点，画面就碎了
  const busy = (x, z) => onPath(x, z) || (Math.abs(x) < 8 && z > 9)
  scene.add(scatter(46, C.white, 0.14, busy), scatter(30, C.lime, 0.17, busy), scatter(20, C.violet, 0.13, busy))

  return { colliders, onPath, update(time) { drift.rotation.y = time * 0.008 } }
}

export function createTrees(scene, colliders) {
  const crowns = []
  function tree(x, z, size, color) {
    const crown = group(at(toy(ball(1.25, 0.9), color, { outline: 0.13 }), 0, 2.45, 0), at(toy(ball(0.8), color, { outline: 0.13 }), 0.75, 1.9, 0.25))
    const whole = group(toy(drum(0.2, 0.28, 1.7, 0.08, 14), C.ink, { outline: 0.1 }), crown)
    whole.scale.setScalar(size)
    crowns.push({ node: crown, phase: x * 0.7 + z })
    colliders.push({ x, z, r: 0.55 * size })
    scene.add(at(whole, x, 0, z))
  }
  const spots = []
  // 树只当背景：外圈一排，里面留四棵。南边的 App 街两侧不种，摊位才看得清
  for (let degrees = -156; degrees <= 156; degrees += 24) spots.push([degrees, 32.2 + ((degrees * 7) % 5) * 0.25])
  spots.push([-88, 13], [88, 13], [-126, 21.5], [126, 21.5])
  spots.forEach(([degrees, radius], i) => {
    const { x, z } = polar(degrees, radius)
    tree(x, z, 0.85 + ((i * 37) % 10) * 0.04, i % 4 === 2 ? C.lilac : C.leaf)
  })
  return { update(time) { for (const crown of crowns) crown.node.rotation.z = Math.sin(time * 1.1 + crown.phase) * 0.035 } }
}
