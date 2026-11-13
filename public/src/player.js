// 小陈：课文的主角，也是在小镇里走来走去的那个人
import * as THREE from 'three'
import { C } from './palette.js'
import { at, ball, box, flat, group, pill, toy } from './toy.js'
import { ISLAND } from './world/ground.js'

const SPEED = 9.5
const BODY = 0.65

/// 和帧率无关的平滑：每秒按 rate 的比例靠过去
export const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt))
const turn = (from, to, rate, dt) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * (1 - Math.exp(-rate * dt))

function figure() {
  const legs = [-0.2, 0.2].map(x => { const pivot = group(at(toy(pill(0.14, 0.3), C.ink, { outline: 0.07 }), 0, -0.3, 0)); return at(pivot, x, 0.62, 0) })
  const arms = [-1, 1].map(side => { const pivot = group(at(toy(pill(0.12, 0.34), C.lime, { outline: 0.07 }), 0, -0.26, 0)); pivot.rotation.z = side * 0.3; return at(pivot, side * 0.5, 1.4, 0) })
  const body = at(toy(pill(0.44, 0.4), C.lime, { outline: 0.09 }), 0, 1.05, 0)
  const pack = at(toy(box(0.62, 0.66, 0.34, 0.14), C.violet, { outline: 0.08 }), 0, 1.12, -0.44)
  const hair = toy(new THREE.SphereGeometry(0.6, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), C.ink, { outline: 0.09 })
  hair.rotation.x = -0.3
  const eyes = [-0.2, 0.2].map(x => at(new THREE.Mesh(ball(0.075, 1.3), flat(C.ink, { glow: true })), x, 0.02, 0.51))
  const head = at(group(toy(ball(0.56), C.skin, { outline: 0.09 }), at(hair, 0, 0.05, -0.03), ...eyes), 0, 2.02, 0)
  const upper = group(body, pack, head, ...arms)
  return { root: group(upper, ...legs), upper, legs, arms, head }
}

export function createPlayer(scene, colliders) {
  const parts = figure()
  const position = parts.root.position.set(0, 0, 12.5)
  const velocity = new THREE.Vector3()
  const state = { goal: null, reach: 0.4, arrive: null, stride: 0, stuck: 0, moving: false }
  parts.root.rotation.y = Math.PI
  parts.root.scale.setScalar(1.25)
  scene.add(parts.root)

  function collide() {
    for (const item of colliders) {
      const dx = position.x - item.x
      const dz = position.z - item.z
      const gap = Math.hypot(dx, dz)
      const min = item.r + BODY
      if (gap < min && gap > 0.0001) { position.x = item.x + dx / gap * min; position.z = item.z + dz / gap * min }
    }
    const edge = Math.hypot(position.x, position.z)
    if (edge > ISLAND - 1.2) { position.x *= (ISLAND - 1.2) / edge; position.z *= (ISLAND - 1.2) / edge }
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
    const swing = Math.sin(state.stride) * Math.min(1, speed / SPEED)
    parts.legs[0].rotation.x = swing * 0.9
    parts.legs[1].rotation.x = -swing * 0.9
    parts.arms[0].rotation.x = -swing * 0.7
    parts.arms[1].rotation.x = swing * 0.7
    parts.upper.position.y = Math.abs(Math.cos(state.stride)) * 0.1 * Math.min(1, speed / SPEED) + Math.sin(time * 2.2) * 0.015
    parts.upper.rotation.x = damp(parts.upper.rotation.x, state.moving ? 0.1 : 0, 8, dt)
  }

  return {
    position, state, root: parts.root,
    update(dt, time, wish) {
      const direction = steer(wish, dt)
      velocity.x = damp(velocity.x, direction.x * SPEED, 11, dt)
      velocity.z = damp(velocity.z, direction.z * SPEED, 11, dt)
      position.x += velocity.x * dt
      position.z += velocity.z * dt
      collide()
      animate(dt, time)
    },
    goTo(x, z, reach = 0.4, arrive = null) { Object.assign(state, { goal: { x, z }, reach, arrive, stuck: 0 }) },
    place(x, z) { position.set(x, 0, z); velocity.set(0, 0, 0); state.goal = null },
  }
}
