// 我的 15 款 App 是藏在林子里的 15 只宝箱。找到一只，打开是一张卡：图标、一句介绍、去 App Store。
// 十二只一直在，有三只挑时候才出现（夜里、雨雪天、冬天），换季换天气就有了再逛一圈的理由
import * as THREE from 'three'
import { at, mat, points, shade } from '../look.js'
import { height } from './land.js'

// [x, z, 朝向, 什么时候才出现]。只有第一只摆在空地边上一眼能看见，算是教人怎么玩；
// 其余的在木屋背后、林子里、溪边、小路尽头，要走过去才发现
export const SPOTS = {
  zenpomo: [7.5, 11, -0.5], darealarm: [-15, 31, 0.9], dontforget: [-20, -12, 1.2], counter: [20.5, -18, -1.1], subli: [10, -32, -0.7],
  cadence: [-20, -36, 0.9], mdqr: [-8.5, -46, 0.4], qrcode: [21, -42, -1], aiprompt: [-20, -59, 1.1], slong: [29, -66, -0.6], led: [-9.5, -75, 0.5], ahhh: [9, -107, -0.4],
  ligit: [-6, 37, 0.3, 'night'], lull: [17.5, 9.5, -1.3, 'rain'], sundial: [-7, -113, 0.4, 'winter'],
}
export const WHEN = { night: '夜里', rain: '雨雪天', winter: '冬天' }
const here = (when, scene) => !when || (when === 'night' ? scene.night > 0.6 : when === 'rain' ? scene.weather === 'rain' || scene.weather === 'snow' : scene.season === 'winter')

function build() {
  const root = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: '#E8B93E', emissive: '#C98F1E', emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.3 })
  root.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.75), mat('#8A5A3A')), 0, 0.275, 0)))
  // 盖子绕着后沿掀开
  const lid = new THREE.Group()
  lid.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.3, 0.81), mat('#9F6C46')), 0, 0.15, 0.4)))
  for (const x of [-0.36, 0.36]) { lid.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.85), gold), x, 0.15, 0.4)); root.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.57, 0.79), gold), x, 0.275, 0)) }
  root.add(at(lid, 0, 0.55, -0.4), at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.1), gold), 0, 0.42, 0.42))
  const glint = new THREE.BufferGeometry()
  glint.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 1.5, 0, 0.35, 1.2, 0.1, -0.3, 1.25, -0.1]), 3))
  // 金点要跟着雾一起淡掉：不受雾影响的话，远处箱子看不见了，三颗点还亮在半空
  const spark = new THREE.Points(glint, points({ color: '#FFE08A', size: 0.34 }))
  root.add(spark)
  return { root, lid, gold, spark }
}

export function createChests(ctx, onOpen) {
  const chests = ctx.apps.filter(app => SPOTS[app.id]).map(app => {
    const [x, z, turn, when] = SPOTS[app.id]
    const made = build()
    made.root.position.set(x, height(x, z), z)
    made.root.rotation.y = turn
    ctx.scene.add(made.root)
    ctx.colliders.push({ x, z, r: 0.7 })
    const chest = { ...made, app, when }
    chest.thing = ctx.things.add({ kind: 'chest', quiet: true, badge: '?', title: '一只宝箱', hint: '打开看看', position: made.root.position, height: 1.2, radius: 1.3, reach: 3, use: () => onOpen(chest) })
    return chest
  })

  /// 找到过的箱子盖子开着、头顶换成那款 App 的图标和名字
  function paint(chest) {
    const found = Boolean(ctx.state.town.chests[chest.app.id])
    chest.lid.rotation.x = found ? -1.15 : 0
    chest.spark.visible = !found
    Object.assign(chest.thing, found ? { icon: chest.app.icon, title: chest.app.zh, hint: chest.app.tagline } : { icon: null, title: '一只宝箱', hint: '打开看看' })
    ctx.things.refresh(chest.thing)
  }
  chests.forEach(paint)

  return {
    chests, paint,
    found: () => chests.filter(chest => ctx.state.town.chests[chest.app.id]).length,
    update(time, scene) {
      for (const chest of chests) {
        // 挑时候的那三只：时候不对就不在；但找到过的就一直留着
        const shown = here(chest.when, scene) || Boolean(ctx.state.town.chests[chest.app.id])
        chest.root.visible = shown
        chest.thing.off = !shown
        chest.gold.emissiveIntensity = 0.25 + scene.night * 0.7
        chest.spark.position.y = Math.sin(time * 2.4 + chest.root.position.x) * 0.12
      }
    },
  }
}
