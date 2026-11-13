// 我的 15 款 App 在小镇里各有一样东西：不是摆个图标，而是把那款 App 的点子做成镇上真能用的物件。
// 每样东西头顶飘着它的 App 图标，用的时候面板底下写着是哪一款、去哪下载
import { polar } from '../toy.js'
import { cadence, lull, ahhh } from './sound.js'
import { led, ligit, mdqr, qrcode } from './signs.js'
import { darealarm, dontforget, sundial, zenpomo } from './time.js'
import { aiprompt, counter, slong, subli } from './tools.js'

const MAKERS = { sundial, zenpomo, dontforget, darealarm, lull, cadence, ahhh, led, ligit, mdqr, qrcode, counter, subli, slong, aiprompt }
// [从正北顺时针的角度, 离广场中心多远]。尽量挨着主题对得上的单元：闹钟和番茄钟在广场，节拍器在「健康与习惯」旁边，订阅亭在「钱与消费」旁边
const PLACES = {
  sundial: [0, 0], zenpomo: [-112, 13.2], led: [0, 13.6], counter: [112, 13.2], darealarm: [-150, 6.2], ligit: [165, 15.4],
  dontforget: [-126, 21.6], mdqr: [-60, 22.4], qrcode: [-45, 20.6], aiprompt: [-18, 21.6], cadence: [18, 21.6], lull: [54, 22], subli: [90, 21.6], slong: [126, 21.6], ahhh: [180, 31],
}

export function createApps(ctx) {
  const updates = []
  for (const app of ctx.apps) {
    const maker = MAKERS[app.id]
    if (!maker) continue
    const [degrees, radius] = PLACES[app.id]
    const { x, z } = polar(degrees, radius)
    const made = maker(ctx, app, { x, z })
    made.node.position.set(x, 0, z)
    if (radius > 0) made.node.rotation.y = Math.atan2(-x, -z)
    ctx.scene.add(made.node)
    if (made.size) ctx.colliders.push({ x, z, r: made.size })
    ctx.things.add({ kind: 'app', title: app.zh, hint: made.hint, icon: app.icon, position: made.node.position, height: made.height, radius: Math.max(1.5, made.size ?? 0), reach: (made.size ?? 0.8) + 2.8, use: made.open })
    if (made.update) updates.push(made.update)
  }
  return { update(dt, time) { for (const update of updates) update(dt, time) } }
}
