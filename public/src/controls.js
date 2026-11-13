// 镜头和操作。走路：WASD / 方向键，或者点地面；点东西就走过去用它；拖动转镜头，滚轮远近
import * as THREE from 'three'
import { damp } from './look.js'

const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] }
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '')

export function createRig(camera) {
  const rig = { yaw: 0, pitch: 0.44, sky: 0, skyGoal: 0, distance: 30, focus: new THREE.Vector3(0, 0, 22), zoomGoal: 30 }
  rig.update = (dt, target) => {
    rig.focus.x = damp(rig.focus.x, target.x, 5, dt)
    rig.focus.z = damp(rig.focus.z, target.z, 5, dt)
    rig.focus.y = damp(rig.focus.y, target.y, 3, dt)
    rig.distance = damp(rig.distance, rig.zoomGoal, 6, dt)
    // 平时是俯视，天不在画面里。要看天（流星）的时候镜头放低、抬头：人留在画面下沿，上半屏让给夜空。
    // 抬得慢、收得快：一走动就得马上看清脚下的路
    rig.sky = damp(rig.sky, rig.skyGoal, rig.skyGoal ? 1.3 : 3.5, dt)
    const pitch = rig.pitch - 0.24 * rig.sky
    const reach = Math.cos(pitch) * rig.distance
    camera.position.set(rig.focus.x + Math.sin(rig.yaw) * reach, rig.focus.y + Math.sin(pitch) * rig.distance, rig.focus.z + Math.cos(rig.yaw) * reach)
    // 看的点比小陈高一截：人落在画面下三分之一，前面的房子和天露出来
    camera.lookAt(rig.focus.x, rig.focus.y + 3.2 + 3.5 * rig.sky, rig.focus.z)
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
    if (press.moved > 8) rig.yaw -= dx * 0.005
    press.x = event.clientX
    press.y = event.clientY
  })
  canvas.addEventListener('pointerup', event => {
    if (!press.active) return
    press.active = false
    if (press.moved > 8 || blocked()) return
    const ray = aim(event)
    if (handlers.onPick(ray)) return
    // 地面有起伏，拿人脚下那么高的一个平面来接点击，近处是准的
    ground.constant = -handlers.groundY()
    if (ray.intersectPlane(ground, point)) handlers.onGround(point)
  })
  // 鼠标从东西上挪到它头顶的标签上不算离开：不然标签一出来就把自己弄没了，来回闪
  canvas.addEventListener('pointerleave', event => { if (!event.relatedTarget?.closest?.('.tag')) { cancelAnimationFrame(hovering); handlers.onHover(null); canvas.style.cursor = '' } })
  canvas.addEventListener('wheel', event => { event.preventDefault(); rig.zoomGoal = Math.min(48, Math.max(16, rig.zoomGoal + event.deltaY * 0.03)) }, { passive: false })

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
