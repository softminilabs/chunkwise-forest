// 植物样张用的小台子：光和单词屋里花盆那个位置一模一样（照 world/room.js 的 lights() 搬的），后面一面木墙、脚下一块地板。
// 松树、桃花、花盆的样张页都用它：光一样，放在一起比才公平
import * as THREE from 'three'
import { at, mat, shade } from '../src/look.js'

/// from、to：镜头在哪儿、看哪儿。原点就是屋里花盆底的位置
export function createStage({ from = [0, 2.2, 9], to = [0, 0.9, 0], night = new URLSearchParams(location.search).has('night') } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.shadowMap.enabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = night ? 1.25 : 1.05
  Object.assign(renderer.domElement.style, { position: 'fixed', inset: 0, width: '100%', height: '100%' })
  document.body.style.margin = 0
  document.body.append(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(night ? '#0B100E' : '#18211D')
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
  camera.position.set(...from)
  camera.lookAt(...to)
  // 夜里只剩很淡的月光，和屋里一个算法（night = 1）
  const dim = night ? 1 : 0
  const sun = at(new THREE.DirectionalLight(night ? '#9DB6DC' : '#FFF1D6', 1.9 - 1.6 * dim), 2.6, 9, 0.25)
  sun.target.position.set(-5.4, 0, 4.75)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.normalBias = 0.03
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: 1, far: 30 })
  scene.add(new THREE.HemisphereLight('#FFF3DF', '#7A6450', 1.25 - 0.93 * dim), sun, sun.target, at(new THREE.DirectionalLight('#FFE9CF', 0.7 - 0.48 * dim), -4.4, 6, 15.25))
  const floor = at(new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), mat('#A27C55')), 0, -0.15, 2)
  const wall = at(new THREE.Mesh(new THREE.BoxGeometry(14, 4.6, 0.3), mat('#C69C70')), 0, 2.3, -0.9)
  floor.receiveShadow = wall.receiveShadow = true
  scene.add(floor, wall)
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(innerWidth, innerHeight, false)
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)
  let last = performance.now()
  return {
    scene, camera, renderer,
    /// 每帧先调 frame(dt, time) 再画
    start(frame) { renderer.setAnimationLoop(now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame?.(dt, now / 1000); renderer.render(scene, camera) }) },
  }
}

/// 临时的花盆，只为了让植物站在该站的高度上（正式的在 src/world/pot.js）。土面在 y = 0.40，半径 0.30
export function standInPot() {
  const group = new THREE.Group()
  // 盆身只做到土面那么高：圆柱是带盖的，再高一点盖子就把土和植物的根脚遮住了
  group.add(shade(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.39, 14), mat('#B8663B')), 0, 0.195, 0)),
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.02, 14), mat('#5B4334')), 0, 0.39, 0))
  return group
}
