// 小陈：课文的主角，也是在森林里走来走去的那个人
import * as THREE from 'three'
import { at, damp, shade } from './look.js'
import { BOUNDS, height } from './world/land.js'

const SPEED = 9.5
const BODY = 0.6
const START = { x: 0.5, z: 26 }
const turn = (from, to, rate, dt) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * (1 - Math.exp(-rate * dt))
const soft = color => new THREE.MeshStandardMaterial({ color, roughness: 1 })

function figure() {
  const limb = (color, x, y) => { const pivot = new THREE.Group(); pivot.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), soft(color)), 0, -0.28, 0))); return at(pivot, x, y, 0) }
  const legs = [-0.17, 0.17].map(x => limb('#3D4A5C', x, 0.6))
  const arms = [-0.46, 0.46].map(x => limb('#E0A63A', x, 1.36))
  const upper = new THREE.Group()
  upper.add(shade(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.5, 6, 12), soft('#E0A63A')), 0, 0.98, 0)))
  upper.add(shade(at(new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), soft('#F7D9BF')), 0, 1.86, 0)))
  upper.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), soft('#232323')), 0, 1.9, -0.03))
  for (const x of [-0.15, 0.15]) upper.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), soft('#232323')), x, 1.86, 0.4))
  upper.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.26), soft('#3F6B55')), 0, 1.02, -0.36))
  upper.add(...arms)
  const root = new THREE.Group()
  root.add(upper, ...legs)
  root.scale.setScalar(1.15)
  return { root, upper, legs, arms }
}

// 森林的地面：有起伏，四周到头
const FOREST = { x: BOUNDS.x, north: BOUNDS.north, south: BOUNDS.south, height, start: START, speed: SPEED, size: 1.15 }

/// ground：他走在哪儿。默认是森林；单词屋里是一块平地，走得慢一点、人按家具的尺寸缩一点
export function createPlayer(scene, colliders, ground = FOREST) {
  const parts = figure()
  parts.root.scale.setScalar(ground.size)
  const position = parts.root.position.set(ground.start.x, ground.height(ground.start.x, ground.start.z), ground.start.z)
  const velocity = new THREE.Vector3()
  const state = { goal: null, reach: 0.4, arrive: null, stride: 0, stuck: 0, moving: false }
  parts.root.rotation.y = Math.PI
  scene.add(parts.root)

  function collide() {
    for (const item of colliders) {
      const dx = position.x - item.x
      const dz = position.z - item.z
      if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue
      const gap = Math.hypot(dx, dz)
      const min = item.r + BODY
      if (gap < min && gap > 0.0001) { position.x = item.x + dx / gap * min; position.z = item.z + dz / gap * min }
    }
    position.x = Math.min(ground.x, Math.max(-ground.x, position.x))
    position.z = Math.min(ground.south, Math.max(ground.north, position.z))
    position.y = ground.height(position.x, position.z)
  }

  /// 走向点到的地方。被东西挡住半天没靠近，就当走到了：别让人看着小陈原地蹭
  function steer(wish, dt) {
    if (wish.lengthSq() > 0.01) { state.goal = null; return wish }
    if (!state.goal) return wish
    const dx = state.goal.x - position.x
    const dz = state.goal.z - position.z
    const gap = Math.hypot(dx, dz)
    state.stuck = velocity.length() < 1.5 ? state.stuck + dt : 0
    if (gap < state.reach || state.stuck > 0.7) {
      const done = gap < state.reach + 2.5 ? state.arrive : null
      state.goal = null
      state.arrive = null
      done?.()
      return wish
    }
    return wish.set(dx / gap, 0, dz / gap)
  }

  function animate(dt, time) {
    const speed = Math.hypot(velocity.x, velocity.z)
    state.moving = speed > 0.6
    if (state.moving) parts.root.rotation.y = turn(parts.root.rotation.y, Math.atan2(velocity.x, velocity.z), 14, dt)
    state.stride += speed * dt * 1.9
    const swing = Math.sin(state.stride) * Math.min(1, speed / ground.speed)
    parts.legs[0].rotation.x = swing * 0.9
    parts.legs[1].rotation.x = -swing * 0.9
    parts.arms[0].rotation.x = -swing * 0.7
    parts.arms[1].rotation.x = swing * 0.7
    parts.upper.position.y = Math.abs(Math.cos(state.stride)) * 0.08 * Math.min(1, speed / ground.speed) + Math.sin(time * 2.2) * 0.012
    parts.upper.rotation.x = damp(parts.upper.rotation.x, state.moving ? 0.1 : 0, 8, dt)
  }

  return {
    position, state, root: parts.root,
    update(dt, time, wish) {
      const direction = steer(wish, dt)
      velocity.x = damp(velocity.x, direction.x * ground.speed, 11, dt)
      velocity.z = damp(velocity.z, direction.z * ground.speed, 11, dt)
      position.x += velocity.x * dt
      position.z += velocity.z * dt
      collide()
      animate(dt, time)
    },
    goTo(x, z, reach = 0.4, arrive = null) { Object.assign(state, { goal: { x, z }, reach, arrive, stuck: 0 }) },
    place(x, z) { position.set(x, ground.height(x, z), z); velocity.set(0, 0, 0); state.goal = null },
    /// 坐下 / 站起来。坐着的时候腿往前伸、手搭在前面；这期间不要再调 update，不然又站直了
    sit(on) {
      state.moving = false
      for (const leg of parts.legs) leg.rotation.x = on ? -1.45 : 0
      for (const arm of parts.arms) arm.rotation.x = on ? -1.0 : 0
      parts.upper.position.y = 0
      parts.upper.rotation.x = 0
    },
  }
}
