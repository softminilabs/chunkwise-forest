// 镜头和操作。走路：WASD / 方向键，或者点地面；点东西就走过去用它；拖动转镜头，滚轮远近
import * as THREE from 'three'
import { damp } from './player.js'

const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] }
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')

export function createRig(camera) {
  const rig = { yaw: 0, yawGoal: null, pitch: 0.5, distance: 32, focus: new THREE.Vector3(0, 0, 8), side: 0, sideGoal: 0, zoomGoal: 32 }
  rig.update = (dt, target) => {
    rig.focus.x = damp(rig.focus.x, target.x, 5, dt)
    rig.focus.z = damp(rig.focus.z, target.z, 5, dt)
    rig.side = damp(rig.side, rig.sideGoal, 4, dt)
    // 用一样东西时镜头绕到它正面去；绕的时候走最近的那一边
    if (rig.yawGoal != null) rig.yaw += Math.atan2(Math.sin(rig.yawGoal - rig.yaw), Math.cos(rig.yawGoal - rig.yaw)) * (1 - Math.exp(-3 * dt))
    rig.distance = damp(rig.distance, rig.zoomGoal, 6, dt)
    const reach = Math.cos(rig.pitch) * rig.distance
    // 右边开着面板时把看的点往右挪，正在用的东西就留在画面左半边，不被面板盖住
    const lookX = rig.focus.x + Math.cos(rig.yaw) * rig.side
    const lookZ = rig.focus.z - Math.sin(rig.yaw) * rig.side
    camera.position.set(lookX + Math.sin(rig.yaw) * reach, Math.sin(rig.pitch) * rig.distance, lookZ + Math.cos(rig.yaw) * reach)
    // 看的点比小陈高一截：人落在画面下三分之一，前面的房子和天露出来
    camera.lookAt(lookX, 3.4, lookZ)
  }
  return rig
}

export function createInput(canvas, camera, rig, handlers) {
  const held = new Set()
  const raycaster = new THREE.Raycaster()
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const point = new THREE.Vector3()
  const press = { active: false, x: 0, y: 0, moved: 0 }
  const blocked = () => document.body.dataset.modal === 'open'
  const aim = event => {
    const box = canvas.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), camera)
    return raycaster.ray
  }
  let hovering = 0
  /// 鼠标指到能用的东西上：光标变手型，它的名字标签冒出来。一帧最多查一次
  const hover = event => {
    cancelAnimationFrame(hovering)
    hovering = requestAnimationFrame(() => { canvas.style.cursor = !blocked() && handlers.onHover(aim(event)) ? 'pointer' : '' })
  }

  addEventListener('keydown', event => {
    if (typing() || event.metaKey || event.ctrlKey) return
    if (event.code === 'Escape') return handlers.onEscape()
    if (blocked()) return
    if (KEYS[event.code]) { held.add(event.code); event.preventDefault() }
    if ((event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') && !event.repeat) { event.preventDefault(); handlers.onUse() }
  })
  addEventListener('keyup', event => held.delete(event.code))
  addEventListener('blur', () => held.clear())

  canvas.addEventListener('pointerdown', event => { Object.assign(press, { active: true, x: event.clientX, y: event.clientY, moved: 0 }); canvas.setPointerCapture(event.pointerId) })
  canvas.addEventListener('pointermove', event => {
    if (!press.active) return hover(event)
    const dx = event.clientX - press.x
    press.moved += Math.abs(dx) + Math.abs(event.clientY - press.y)
    if (press.moved > 8) { rig.yaw -= dx * 0.005; rig.yawGoal = null }
    press.x = event.clientX
    press.y = event.clientY
  })
  canvas.addEventListener('pointerup', event => {
    if (!press.active) return
    press.active = false
    if (press.moved > 8 || blocked()) return
    const ray = aim(event)
    if (handlers.onPick(ray)) return
    if (ray.intersectPlane(ground, point)) handlers.onGround(point)
  })
  // 鼠标从东西上挪到它头顶的标签上不算离开：不然标签一出来就把自己弄没了，来回闪
  canvas.addEventListener('pointerleave', event => { if (!event.relatedTarget?.closest?.('.tag')) { cancelAnimationFrame(hovering); handlers.onHover(null); canvas.style.cursor = '' } })
  canvas.addEventListener('wheel', event => { event.preventDefault(); rig.zoomGoal = Math.min(60, Math.max(18, rig.zoomGoal + event.deltaY * 0.03)) }, { passive: false })

  return {
    /// 按键换算成世界里的方向：以镜头朝向为准，W 永远是往画面上方走
    wish(out) {
      let x = 0
      let y = 0
      if (!blocked()) for (const code of held) { x += KEYS[code][0]; y += KEYS[code][1] }
      const length = Math.hypot(x, y) || 1
      const forwardX = -Math.sin(rig.yaw)
      const forwardZ = -Math.cos(rig.yaw)
      return out.set((x * Math.cos(rig.yaw) + y * forwardX) / length, 0, (-x * Math.sin(rig.yaw) + y * forwardZ) / length)
    },
  }
}
