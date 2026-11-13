// 我的 15 款 App 在小镇里各有一样东西：不是摆个图标，而是把那款 App 的点子做成镇上真能用的物件。
// 怎么摆：十五样东西各长各的样，散着放、排成街都显得乱。所以十二款做成一模一样的小摊位，围着广场摆成一圈集市，
// 招牌就是 App 的图标，柜台上摆着它那件小东西；只有三样自己立着——日晷（管天色）、闹钟（管今天的任务）、灯牌
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, box, group, pill, polar, toy } from '../toy.js'
import { cadence, lull, ahhh } from './sound.js'
import { led, ligit, mdqr, qrcode } from './signs.js'
import { darealarm, dontforget, sundial, zenpomo } from './time.js'
import { aiprompt, counter, slong, subli } from './tools.js'

const MAKERS = { sundial, zenpomo, dontforget, darealarm, lull, cadence, ahhh, led, ligit, mdqr, qrcode, counter, subli, slong, aiprompt }
const ALONE = { sundial: { x: 0, z: 0 }, darealarm: polar(-150, 6.2), led: polar(0, 16.6) }
// 摊位在广场外沿的角度（正北为 0，顺时针）。南边留空：那是入口，也是镜头的方向
const STALLS = { dontforget: -99, subli: -81, counter: -63, zenpomo: -45, cadence: -27, lull: -9, ahhh: 9, mdqr: 27, qrcode: 45, slong: 63, aiprompt: 81, ligit: 99 }
const STALL_RING = 12.4
export const ZONES = [['广场上', ['sundial', 'darealarm', 'led']], ['围着广场的集市', Object.keys(STALLS)]]
const loader = new THREE.TextureLoader()

/// 一个摊位：柜台、两根杆子撑着条纹棚子、顶上的招牌是这款 App 的图标，柜台上摆着它那件东西的缩小版
function stallOf(app, made, index) {
  const tone = index % 2 ? C.lime : C.violet
  const stripes = Array.from({ length: 5 }, (_, k) => at(toy(box(0.56, 0.24, 1.5, 0.1), k % 2 ? C.white : tone, { outline: 0.08 }), -1.12 + k * 0.56, 0, 0))
  const awning = group(...stripes)
  awning.rotation.x = 0.3
  const face = loader.load(app.icon)
  face.colorSpace = THREE.SRGBColorSpace
  made.node.scale.setScalar(Math.min(0.5, 1.3 / made.height))
  return group(
    at(toy(box(2.6, 1.0, 1.3, 0.22), C.white, { outline: 0.11 }), 0, 0.5, 0),
    ...[-1.15, 1.15].map(x => at(toy(pill(0.07, 1.5), C.ink, { outline: 0.05 }), x, 1.85, -0.45)),
    at(awning, 0, 2.7, 0.15),
    at(toy(box(1.5, 1.5, 0.16, 0.3), C.white, { outline: 0.1 }), 0, 3.8, -0.45),
    at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: face })), 0, 3.8, -0.36),
    at(made.node, 0, 1.0, 0.1))
}

export function createApps(ctx) {
  const updates = []
  ctx.apps.forEach((app, index) => {
    const maker = MAKERS[app.id]
    if (!maker) return
    const alone = ALONE[app.id]
    const place = alone ?? polar(STALLS[app.id], STALL_RING)
    const made = maker(ctx, app, place)
    const node = alone ? made.node : stallOf(app, made, index)
    node.position.set(place.x, 0, place.z)
    node.rotation.y = Math.hypot(place.x, place.z) > 0.1 ? Math.atan2(-place.x, -place.z) : 0
    ctx.scene.add(node)
    const size = alone ? made.size : 1.5
    if (size) ctx.colliders.push({ x: place.x, z: place.z, r: size })
    ctx.things.add({ id: app.id, kind: 'app', title: app.zh, hint: made.hint, icon: app.icon, position: node.position, height: alone ? made.height : 4.7, radius: Math.max(1.5, size ?? 0), reach: (size ?? 0.8) + 2.8, use: made.open })
    if (made.update) updates.push(made.update)
  })
  return { update(dt, time) { for (const update of updates) update(dt, time) } }
}
