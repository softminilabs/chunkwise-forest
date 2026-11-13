// 跟时间有关的四样：日晷（岁时）、钟楼（番茄钟）、日历牌（念念）、满广场跑的闹钟（特工闹钟）
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, ball, box, canvasTexture, drum, group, pill, toy } from '../toy.js'
import { h } from '../ui/core.js'

const pad = value => String(value).padStart(2, '0')
const bar = (label, part, cls = '') => h('div', {}, h('p', { class: 'note' }, `${label} · ${Math.round(part * 100)}%`), h('div', { class: `bar ${cls}` }, h('i', { style: `width:${part * 100}%` })))

function dial(draw) {
  const texture = canvasTexture(256, 256, draw)
  return { texture, redraw() { draw(texture.image.getContext('2d'), 256, 256); texture.needsUpdate = true } }
}

function drawClock(context, size, date = new Date()) {
  const mid = size / 2
  context.fillStyle = C.white
  context.fillRect(0, 0, size, size)
  context.strokeStyle = C.ink
  context.lineCap = 'round'
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; context.lineWidth = k % 3 ? 5 : 10; context.beginPath(); context.moveTo(mid + Math.sin(a) * 96, mid - Math.cos(a) * 96); context.lineTo(mid + Math.sin(a) * 112, mid - Math.cos(a) * 112); context.stroke() }
  const hand = (turn, length, width, color) => { context.strokeStyle = color; context.lineWidth = width; context.beginPath(); context.moveTo(mid, mid); context.lineTo(mid + Math.sin(turn * Math.PI * 2) * length, mid - Math.cos(turn * Math.PI * 2) * length); context.stroke() }
  hand((date.getHours() % 12 + date.getMinutes() / 60) / 12, 56, 14, C.ink)
  hand(date.getMinutes() / 60, 88, 9, C.violet)
}

/// 岁时：广场中间的日晷。小镇的天色本来就跟着真实时间走，这里能看今天、本周、今年各过了多少，还能拨时间
export function sundial(ctx, app) {
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.05, 48), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 256, (context, size) => { drawClock(context, size, new Date(2000, 0, 1, 0, 0)); context.fillStyle = C.white; context.beginPath(); context.arc(size / 2, size / 2, 92, 0, Math.PI * 2); context.fill() }) }))
  face.rotation.x = -Math.PI / 2
  const fin = toy(box(0.2, 1.7, 2.1, 0.09), C.violet, { outline: 0.09 })
  fin.rotation.x = -0.62
  const node = group(toy(drum(2.25, 2.45, 0.5, 0.16), C.white, { outline: 0.12 }), at(face, 0, 0.51, 0), at(fin, 0, 0.95, -0.25))
  function open() {
    const now = new Date()
    const day = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
    const year = new Date(now.getFullYear(), 0, 1)
    const days = (new Date(now.getFullYear() + 1, 0, 1) - year) / 86400000
    const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const label = h('strong', {}, '现在')
    const slider = h('input', { type: 'range', min: 0, max: 24, step: 0.25, value: now.getHours() + now.getMinutes() / 60, 'aria-label': '拨动时间', oninput: () => { ctx.sky.setHour(Number(slider.value)); label.textContent = `${pad(Math.floor(slider.value))}:${pad(Math.round(slider.value % 1 * 60))}` } })
    ctx.ui.openDrawer({
      kicker: '把时间放在看得见的地方', title: `${pad(now.getHours())}:${pad(now.getMinutes())}`, sub: '小镇的天色、影子、灯，都跟着你这边的真实时间走。', app,
      onClose: () => ctx.sky.setHour(null),
      body: [bar('今天', day), bar('本周', ((now.getDay() + 6) % 7 + day) / 7, 'lime'), bar('本月', (now.getDate() - 1 + day) / monthDays), bar('今年', ((now - year) / 86400000) / days, 'lime'),
        h('div', { class: 'tile' }, h('h3', {}, '拨一拨，看看小镇的一天 · ', label), slider, h('button', { class: 'chip', type: 'button', onclick: () => { ctx.sky.setHour(null); label.textContent = '现在' } }, '回到现在'))],
    })
  }
  return { node, height: 2.6, size: 2.5, hint: '看今天过了多少', open }
}

/// 番茄钟：钟楼。开一个专注，时间到了楼顶多结一个番茄
export function zenpomo(ctx, app) {
  const clock = dial((context, size) => drawClock(context, size))
  const tomato = at(group(toy(ball(0.8, 0.86), C.violet, { outline: 0.1 }), at(toy(ball(0.26, 0.5), C.lime, { outline: 0.06 }), 0, 0.68, 0)), 0, 5.1, 0)
  const node = group(toy(drum(1.05, 1.3, 4.4, 0.25), C.lilac, { outline: 0.13 }), at(toy(drum(1.35, 1.2, 0.35, 0.12), C.white, { outline: 0.1 }), 0, 4.2, 0), tomato,
    at(new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), new THREE.MeshBasicMaterial({ map: clock.texture })), 0, 3.1, 1.2), at(toy(box(0.9, 1.4, 0.2, 0.25), C.ink, { outline: 0.08 }), 0, 0.7, 1.28))
  const chip = h('div', { class: 'focus sticker', hidden: true })
  document.body.append(chip)
  let minute = -1
  const left = () => Math.max(0, (ctx.state.town.focusUntil ?? 0) - Date.now())
  const text = () => `${pad(Math.floor(left() / 60000))}:${pad(Math.floor(left() / 1000) % 60)}`
  function open() {
    const running = left() > 0
    const startFocus = minutes => { ctx.state.patch({ focusUntil: Date.now() + minutes * 60000 }); ctx.audio.bell(); ctx.ui.closeDrawer(); ctx.ui.toast(`专注开始，<b>${minutes} 分钟</b>后见`) }
    ctx.ui.openDrawer({
      kicker: '安静地专注一会儿', title: running ? `还剩 ${text()}` : '开一个番茄', sub: `已经收了 ${ctx.state.town.tomatoes} 个番茄。时间到了，钟楼顶上会再结一个。`, app,
      body: running ? [h('p', { class: 'note' }, '专注进行中。去读一课，或者练一轮，时间到了会叫你。'), h('button', { class: 'chip', type: 'button', onclick: () => { ctx.state.patch({ focusUntil: 0 }); ctx.ui.closeDrawer() } }, '放弃这一个')]
        : [h('p', { class: 'note' }, '选个时长。专注的时候可以照常读课文、练卡片。'), h('div', { class: 'row' }, [5, 15, 25].map(minutes => h('button', { class: 'button big', type: 'button', onclick: () => startFocus(minutes) }, `${minutes} 分钟`)))],
    })
  }
  function update(dt, time) {
    const now = new Date()
    if (now.getMinutes() !== minute) { minute = now.getMinutes(); clock.redraw() }
    tomato.scale.setScalar(1 + Math.sin(time * 2) * 0.03)
    const until = ctx.state.town.focusUntil ?? 0
    chip.hidden = !until
    if (!until) return
    chip.textContent = `专注 ${text()}`
    if (left() > 0) return
    ctx.state.patch({ focusUntil: 0, tomatoes: ctx.state.town.tomatoes + 1 })
    ctx.audio.bell()
    ctx.fx.burst(node.position.x, 5.6, node.position.z, 20)
    ctx.ui.toast(`专注完成，<b>+1 个番茄</b>`)
  }
  return { node, height: 6.2, size: 1.5, hint: '开一个专注', open, update }
}

/// 念念：日历牌，记着你连续学了几天
export function dontforget(ctx, app) {
  const draw = (context, size) => {
    context.fillStyle = C.white
    context.fillRect(0, 0, size, size)
    context.fillStyle = C.violet
    context.fillRect(0, 0, size, 62)
    context.fillStyle = C.white
    context.font = '800 34px "Yuanti SC", "PingFang SC", sans-serif'
    context.textAlign = 'center'
    context.fillText('连续', size / 2, 44)
    context.fillStyle = C.ink
    context.font = '800 130px ui-rounded, "SF Pro Rounded", sans-serif'
    context.fillText(String(ctx.state.streak()), size / 2, 190)
    context.font = '800 30px "Yuanti SC", "PingFang SC", sans-serif'
    context.fillText('天', size / 2, 236)
  }
  const page = dial(draw)
  const node = group(at(toy(box(2.5, 2.5, 0.3, 0.2), C.white, { outline: 0.12 }), 0, 2.15, 0), at(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: page.texture })), 0, 2.15, 0.16),
    ...[-0.8, 0.8].map(x => at(toy(pill(0.09, 0.9), C.ink, { outline: 0.06 }), x, 0.5, 0)), ...[-0.6, 0.6].map(x => at(toy(pill(0.08, 0.3), C.lime, { outline: 0.05 }), x, 3.45, 0)))
  ctx.state.on(page.redraw)
  function open() {
    const totals = ctx.state.totals()
    const unit = ctx.course.units.find(item => item.lessons.some(lesson => !ctx.state.stars(lesson.id))) ?? ctx.course.units.at(-1)
    const leftInUnit = unit.lessons.filter(lesson => !ctx.state.stars(lesson.id)).length
    ctx.ui.openDrawer({
      kicker: '别忘了在乎的日子', title: `连续 ${ctx.state.streak()} 天`, sub: '每天读完一课就算一天。今天还没读也不断，明天之前补上就行。', app,
      body: [h('div', { class: 'week' }, ctx.state.week().map((on, k) => h('i', { class: on ? 'is-on' : '', title: k === 6 ? '今天' : '' }))),
        h('div', { class: 'tile' }, h('h3', {}, `来小镇第 ${totals.days} 天`), h('p', {}, '从你第一次进小镇那天算起。')),
        h('div', { class: 'tile' }, h('h3', {}, `离点亮「${unit.zh}」还差 ${leftInUnit} 课`), h('p', {}, `整个 B1 还差 ${totals.lessons - totals.lit} 课。`))],
    })
  }
  return { node, height: 3.8, size: 1.4, hint: '连续学了几天', open }
}

/// 特工闹钟：今天的任务没闯完，它就满广场蹦；闯完了才肯坐下睡觉
export function darealarm(ctx, app) {
  const eyes = [-0.3, 0.3].map(x => at(toy(ball(0.11, 1.3), C.ink, { outline: 0 }), x, 0.1, 0.84))
  const body = group(toy(ball(0.9), C.violet, { outline: 0.11 }), at(toy(ball(0.62, 0.9), C.white, { outline: 0 }), 0, 0, 0.36), ...eyes,
    ...[-1, 1].map(side => at(toy(ball(0.36), C.lime, { outline: 0.08 }), side * 0.62, 0.78, 0)), at(toy(pill(0.06, 0.3), C.ink, { outline: 0.05 }), 0, 1.1, 0))
  const legs = [-0.35, 0.35].map(x => at(toy(pill(0.11, 0.3), C.ink, { outline: 0.06 }), x, 0.28, 0))
  const node = group(at(body, 0, 1.35, 0), ...legs)
  let angle = -150 * Math.PI / 180
  let done = ctx.state.mission().done
  ctx.state.on(() => { const now = ctx.state.mission().done; if (now && !done) ctx.ui.toast('今天的关闯完了，<b>闹钟安静了</b>'); done = now })
  function open() {
    const mission = ctx.state.mission()
    ctx.ui.openDrawer({
      kicker: '不闯关就关不掉', title: mission.done ? '今天的关闯完了' : '今天的任务', sub: mission.done ? '闹钟睡了。明天它还会来蹦。' : '两件事都做完，它才肯安静。', app,
      body: [h('div', {}, h('p', { class: 'note' }, `读完 ${mission.lessons} / ${mission.goal} 课`), h('div', { class: 'bar lime' }, h('i', { style: `width:${mission.lessons / mission.goal * 100}%` }))),
        h('div', {}, h('p', { class: 'note' }, `练习里答对 ${mission.right} / ${mission.rightGoal} 张卡`), h('div', { class: 'bar' }, h('i', { style: `width:${mission.right / mission.rightGoal * 100}%` }))),
        !mission.done && h('div', { class: 'row' }, h('button', { class: 'button big', type: 'button', onclick: () => ctx.continueLearning() }, '去读一课'), h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openPractice() }, '去练一轮'))],
    })
  }
  function update(dt, time) {
    if (done) { node.position.set(3.4, 0, 2.6); body.position.y = 1.0 + Math.sin(time * 1.5) * 0.03; body.rotation.z = 0.25; return }
    angle += dt * 0.55
    node.position.set(Math.sin(angle) * 6.2, 0, -Math.cos(angle) * 6.2)
    node.rotation.y = Math.PI - angle + Math.PI / 2
    const hop = Math.abs(Math.sin(time * 7))
    body.position.y = 1.35 + hop * 0.4
    body.rotation.z = Math.sin(time * 14) * 0.12
    legs[0].position.y = 0.28 + Math.max(0, Math.sin(time * 7)) * 0.2
    legs[1].position.y = 0.28 + Math.max(0, -Math.sin(time * 7)) * 0.2
  }
  return { node, height: 2.6, hint: '今天的任务', open, update }
}
