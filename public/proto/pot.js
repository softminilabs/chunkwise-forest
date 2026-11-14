// 花盆的样张：用屋里浇水时的镜头看花盆和喷壶，试浇水、长大、长成那一下的动画。
// ?view=top 从上往下 45° 看，?view=room 屋里平时那么远；?kind=standin|pine|peach 种哪种；?night 夜里的光；
// ?buddy 摆一个和屋里浇水的小人一样大的替身，看壶有没有被他挡住。
// window.pot 是那只花盆，截图脚本拿它在动画中途截图
import * as THREE from 'three'
import { at, mat, shade } from '../src/look.js'
import { createPot } from '../src/world/pot.js'
import { createStage } from './plant-stage.js'

const VIEWS = { near: [[0.05, 1.75, 4.3], [-0.3, 1.05, 0]], top: [[0.2, 3.5, 3.3], [-0.15, 0.3, 0]], room: [[-4.4, 6.4, 16.6], [0, 0.8, 0]] }
const LEAF = mat('#4FA058')
const BARK = mat('#7A5C46')
// 替身植物：接口和真的松树、桃花一样，真的加载不到的时候用它
const standin = {
  id: 'standin', drops: 20,
  build(stage) {
    const group = new THREE.Group()
    const tall = [0.05, 0.18, 0.5, 0.95, 1.35][stage]
    if (!stage) return group.add(shade(at(new THREE.Mesh(new THREE.IcosahedronGeometry(tall / 2, 0), BARK), 0, tall / 2, 0)))
    const layer = 0.75 * tall / (1 + 0.6 * (stage - 1))
    group.add(shade(at(new THREE.Mesh(new THREE.CylinderGeometry(tall * 0.03, tall * 0.045, tall * 0.5, 6), BARK), 0, tall * 0.25, 0)))
    for (let k = 0; k < stage; k++) group.add(shade(at(new THREE.Mesh(new THREE.ConeGeometry(tall * 0.2 * (1 + 0.35 * k), layer, 7), LEAF), 0, tall - layer / 2 - k * 0.6 * layer, 0)))
    return group
  },
  sway(group, time) { group.rotation.z = Math.sin(time * 1.2) * 0.015 },
}

const params = new URLSearchParams(location.search)
const stage = createStage()
const look = (from, to) => { stage.camera.position.set(...from); stage.camera.lookAt(...to) }
look(...(VIEWS[params.get('view')] ?? VIEWS.near))
const pot = createPot()
stage.scene.add(pot.group)
if (params.has('buddy')) {
  // 屋里浇水时小人站的地方（花盆左前方，背朝镜头）：身子占的那一块是个半透明的盒子，头是个大球
  const ghost = new THREE.MeshBasicMaterial({ color: '#F3EFE4', transparent: true, opacity: 0.35, depthWrite: false })
  stage.scene.add(at(new THREE.Mesh(new THREE.BoxGeometry(1, 2.07, 1), ghost), -1, 1.035, 0.9), at(new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), mat('#E9CC7A')), -1, 1.6, 0.9))
}

const kinds = { standin }
for (const name of ['pine', 'peach']) {
  // 另外两个模块可能还没写好：加载不到就把那颗按钮关掉，用替身
  try { kinds[name] = (await import(`../src/world/plants/${name}.js`))[name] } catch { document.querySelector(`[data-kind="${name}"]`).disabled = true }
}
let kind = kinds[params.get('kind')] ?? kinds.pine ?? standin
// 盆里现在几成；null 是空盆
let grown = null
let busy = false

function put(value) {
  grown = value
  pot.plant(value === null ? null : kind, value ?? 0)
  for (const button of document.querySelectorAll('[data-kind]')) button.classList.toggle('is-on', kinds[button.dataset.kind] === kind)
}
/// 浇到 to 成；celebrate：浇完再庆祝一下
async function water(to, celebrate = false) {
  if (busy || grown === null) return
  busy = true
  grown = Math.min(1, to)
  await pot.water(grown)
  if (celebrate) await pot.bloom()
  busy = false
}

for (const button of document.querySelectorAll('[data-kind]')) button.onclick = () => { kind = kinds[button.dataset.kind]; put(grown ?? 0) }
for (const button of document.querySelectorAll('[data-put]')) button.onclick = () => put(button.dataset.put === 'empty' ? null : Number(button.dataset.put))
document.querySelector('[data-do="water"]').onclick = () => water(grown + 0.25)
document.querySelector('[data-do="finish"]').onclick = () => water(1, true)
put(null)
Object.assign(window, { pot, stage, kinds, look, put })

stage.start((dt, time) => pot.frame(dt, time))
