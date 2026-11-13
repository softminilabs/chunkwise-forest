// 我的 15 款 App 在小镇里各有一样东西：不是摆个图标，而是把那款 App 的点子做成镇上真能用的物件。
// 每样东西头顶飘着它的 App 图标，用的时候面板底下写着是哪一款、去哪下载
import { polar } from '../toy.js'
import { cadence, lull, ahhh } from './sound.js'
import { led, ligit, mdqr, qrcode } from './signs.js'
import { darealarm, dontforget, sundial, zenpomo } from './time.js'
import { aiprompt, counter, slong, subli } from './tools.js'

const MAKERS = { sundial, zenpomo, dontforget, darealarm, lull, cadence, ahhh, led, ligit, mdqr, qrcode, counter, subli, slong, aiprompt }
// 街两边的摊位：斜着朝向中间的路，也半朝着南边的镜头，从入口望进去看得见正面
const stall = (side, z) => ({ x: side * 4.6, z, face: -side * (Math.PI / 2 - 0.55) })
// 东西怎么摆：满岛散着放看起来乱，所以分三处——
// 广场上是和整个小镇有关的（日晷管天色、闹钟管今天的任务）；广场北侧立三个高的地标；其余小件在南边排成一条「App 街」
const PLACES = {
  sundial: { x: 0, z: 0 }, darealarm: polar(-150, 6.2),
  zenpomo: polar(-32, 13.6), led: polar(0, 13.8), mdqr: polar(32, 13.8), qrcode: polar(53, 12.2),
  dontforget: stall(-1, 13.5), counter: stall(-1, 18), subli: stall(-1, 22.5), cadence: stall(-1, 27),
  aiprompt: stall(1, 13.5), slong: stall(1, 18), lull: stall(1, 22.5), ligit: { x: 2.3, z: 26, face: 0 },
  ahhh: { ...polar(180, 31.5), face: 0 },
}
export const ZONES = [['广场', ['sundial', 'darealarm']], ['广场北侧的地标', ['zenpomo', 'led', 'mdqr', 'qrcode']], ['南边的 App 街', ['dontforget', 'counter', 'subli', 'cadence', 'aiprompt', 'slong', 'lull', 'ligit', 'ahhh']]]

export function createApps(ctx) {
  const updates = []
  for (const app of ctx.apps) {
    const maker = MAKERS[app.id]
    if (!maker) continue
    const place = PLACES[app.id]
    const made = maker(ctx, app, place)
    made.node.position.set(place.x, 0, place.z)
    made.node.rotation.y = place.face ?? (Math.hypot(place.x, place.z) > 0.1 ? Math.atan2(-place.x, -place.z) : 0)
    ctx.scene.add(made.node)
    if (made.size) ctx.colliders.push({ x: place.x, z: place.z, r: made.size })
    // steady：街上的摊位用的时候镜头不转。左右两排来回逛，镜头跟着转来转去会晕
    ctx.things.add({ id: app.id, kind: 'app', title: app.zh, hint: made.hint, icon: app.icon, position: made.node.position, height: made.height, radius: Math.max(1.5, made.size ?? 0), reach: (made.size ?? 0.8) + 2.8, steady: place.face != null, use: made.open })
    if (made.update) updates.push(made.update)
  }
  return { update(dt, time) { for (const update of updates) update(dt, time) } }
}
