// 四样小工具：计数器、订阅亭（订况）、三脚架上的相机（长图拼接）、出题的机器人（Ai Prompt）
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, ball, box, canvasTexture, drum, group, pill, toy } from '../toy.js'
import { h } from '../ui/core.js'

/// 计数器：点一下加一。面板开着的时候，空格就是点
export function counter(ctx, app) {
  const draw = (context, width, height) => {
    context.fillStyle = '#16141c'
    context.fillRect(0, 0, width, height)
    context.fillStyle = C.lime
    context.font = '800 92px ui-rounded, "SF Pro Rounded", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(ctx.state.town.taps).padStart(4, '0'), width / 2, height / 2 + 6)
  }
  const face = canvasTexture(256, 128, draw)
  const button = at(toy(drum(0.6, 0.66, 0.42, 0.14), C.lime, { outline: 0.09 }), 0, 1.72, 0)
  const node = group(toy(drum(1.0, 1.1, 1.75, 0.3), C.ink, { outline: 0.12 }), button, at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: face })), 0, 0.95, 1.08))
  let panel = null
  let press = 0
  function tap() {
    ctx.state.patch({ taps: ctx.state.town.taps + 1 })
    draw(face.image.getContext('2d'), 256, 128)
    face.needsUpdate = true
    press = 1
    ctx.audio.tick(ctx.state.town.taps % 10 === 0)
    if (panel) panel.textContent = String(ctx.state.town.taps)
  }
  function open() {
    if (panel) return tap()
    panel = h('p', { class: 'big-number center' }, String(ctx.state.town.taps))
    const totals = ctx.state.totals()
    ctx.ui.openDrawer({ kicker: '点一下就好', title: '计数器', sub: '想数什么数什么：今天开口说了几句、单词抄了几遍。面板开着时，按空格也算一下。', app, onClose: () => { panel = null },
      body: [panel, h('button', { class: 'tap', type: 'button', onclick: tap }, '+1'), h('div', { class: 'tile' }, h('h3', {}, '小镇替你数着的'), h('p', {}, `亮了 ${totals.lit} 盏灯 · 收了 ${totals.cards} 张卡片 · 结了 ${ctx.state.town.tomatoes} 个番茄`)), h('button', { class: 'chip', type: 'button', onclick: () => { ctx.state.patch({ taps: -1 }); tap() } }, '归零')] })
  }
  function update(dt) { press = Math.max(0, press - dt * 6); button.position.y = 1.72 - press * 0.2 }
  return { node, height: 2.8, size: 1.3, hint: '点一下加一', open, update }
}

const PLANS = [[1, '轻松', '每天 1 课'], [2, '标准', '每天 2 课'], [3, '认真', '每天 3 课']]

/// 订况：订阅亭。在这儿订你每天的学习量，墙上是这一周的打卡
export function subli(ctx, app) {
  const stripes = Array.from({ length: 5 }, (_, k) => at(toy(box(0.62, 0.3, 1.3, 0.12), k % 2 ? C.white : C.violet, { outline: 0.08 }), -1.24 + k * 0.62, 0, 0))
  const awning = group(...stripes)
  awning.rotation.x = 0.35
  const node = group(at(toy(box(3.0, 2.3, 1.7, 0.3), C.white, { outline: 0.12 }), 0, 1.15, 0), at(awning, 0, 2.3, 1.1), at(toy(box(3.2, 0.3, 0.5, 0.1), C.ink, { outline: 0.08 }), 0, 1.15, 0.95), at(toy(box(0.7, 0.9, 0.1, 0.08), C.lime, { outline: 0 }), -0.8, 1.9, 0.86), at(toy(box(0.7, 0.9, 0.1, 0.08), C.lilac, { outline: 0 }), 0.1, 1.9, 0.86))
  function open() {
    const row = h('div', { class: 'lessons' })
    const paint = () => row.replaceChildren(...PLANS.map(([goal, name, text]) => h('button', { class: `lesson${ctx.state.town.goal === goal ? ' is-next' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ goal }); ctx.audio.pop(); paint() } }, h('b', {}, String(goal)), h('div', {}, h('strong', {}, name), h('small', {}, text)), h('span', {}, ctx.state.town.goal === goal ? '已订' : ''))))
    paint()
    const week = ctx.state.week()
    ctx.ui.openDrawer({ kicker: '看清你订了什么', title: '每天学多少', sub: '订了就要用。闹钟每天按这个量催你，随时可以改。', app,
      body: [row, h('div', { class: 'tile' }, h('h3', {}, `这一周打卡 ${week.filter(Boolean).length} 天`), h('div', { class: 'week', style: 'margin-top:10px' }, week.map(on => h('i', { class: on ? 'is-on' : '' }))))] })
  }
  return { node, height: 3.6, size: 1.9, hint: '订每天的学习量', open }
}

/// 长图拼接：相机。拍两张小镇再接上你的成绩，拼成一张能发出去的长图
export function slong(ctx, app) {
  const legs = [[-0.5, 0.3], [0.5, 0.3], [0, -0.55]].map(([x, z]) => { const leg = toy(pill(0.06, 1.7), C.ink, { outline: 0.05 }); leg.rotation.set(z * 0.5, 0, -x * 0.5); return at(leg, x * 0.55, 0.85, z * 0.55) })
  const lens = toy(drum(0.3, 0.36, 0.5, 0.08, 20), C.ink, { outline: 0.07 })
  lens.rotation.x = Math.PI / 2
  const node = group(...legs, at(toy(box(1.1, 0.8, 0.7, 0.18), C.violet, { outline: 0.1 }), 0, 2.05, 0), at(lens, 0, 2.05, 0.3), at(toy(ball(0.14), C.lime, { outline: 0.05 }), 0.38, 2.52, 0))
  function capture() {
    const { renderer, camera, scene } = ctx
    const source = renderer.domElement
    const width = 1080
    const frame = Math.round(width * source.height / source.width)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = frame * 2 + 300
    const context = canvas.getContext('2d')
    // 渲染完紧接着就画到画布上：过了这一帧，WebGL 的画面缓冲就清掉了，拿到的会是一张白图
    renderer.render(scene, camera)
    context.drawImage(source, 0, 0, width, frame)
    const pose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() }
    camera.position.set(0, 64, 52)
    camera.lookAt(0, 0, 4)
    renderer.render(scene, camera)
    context.drawImage(source, 0, frame, width, frame)
    camera.position.copy(pose.position)
    camera.quaternion.copy(pose.quaternion)
    const totals = ctx.state.totals()
    context.fillStyle = C.ink
    context.fillRect(0, frame * 2, width, 300)
    context.fillStyle = C.lime
    context.font = '800 76px "Yuanti SC", "PingFang SC", sans-serif'
    context.fillText('我的组块小镇', 60, frame * 2 + 120)
    context.fillStyle = C.white
    context.font = '600 40px "Yuanti SC", "PingFang SC", sans-serif'
    context.fillText(`亮灯 ${totals.lit} / ${totals.lessons}   卡片 ${totals.cards} 张   连续 ${ctx.state.streak()} 天`, 60, frame * 2 + 205)
    return canvas.toDataURL('image/png')
  }
  function open() {
    const holder = h('div', {}, h('p', { class: 'note' }, '点下面的按钮：一张近景、一张全景，再接上你的成绩，拼成一张长图。'))
    const shoot = () => { ctx.audio.pop(); const url = capture(); holder.replaceChildren(h('img', { class: 'photo', src: url, alt: '小镇的长图：近景、全景和学习成绩' }), h('a', { class: 'button', href: url, download: '组块小镇.png', style: 'margin-top:12px' }, '保存图片')) }
    ctx.ui.openDrawer({ kicker: '一张看不出接缝的长图', title: '拍一张小镇', sub: '灯亮得越多，拍出来越好看。', app, body: [h('button', { class: 'button big', type: 'button', onclick: shoot }, '拍一张'), holder] })
  }
  return { node, height: 3.4, size: 0.9, hint: '拍张长图发出去', open }
}

/// Ai Prompt：出题的机器人。从你收的卡片里挑一张，让你用它说一句自己的话
export function aiprompt(ctx, app) {
  const eyes = [-0.28, 0.28].map(x => at(new THREE.Mesh(ball(0.13), new THREE.MeshBasicMaterial({ color: C.lime })), x, 0, 0.52))
  const head = at(group(toy(box(1.35, 1.0, 1.0, 0.28), C.ink, { outline: 0.1 }), ...eyes, at(toy(pill(0.04, 0.4), C.ink, { outline: 0.04 }), 0, 0.75, 0), at(toy(ball(0.13), C.lime, { outline: 0.05 }), 0, 1.05, 0)), 0, 2.05, 0)
  const node = group(at(toy(box(1.1, 1.2, 0.85, 0.3), C.white, { outline: 0.1 }), 0, 0.85, 0), head, ...[-1, 1].map(side => at(toy(pill(0.11, 0.5), C.white, { outline: 0.07 }), side * 0.72, 0.95, 0)), at(toy(box(0.5, 0.3, 0.1, 0.08), C.violet, { outline: 0 }), 0, 0.95, 0.44))
  function open() {
    const holder = h('div', { class: 'tile' })
    const next = () => {
      const owned = ctx.state.owned()
      const pool = owned.length ? owned : ctx.course.units[0].lessons[0].cards
      const card = ctx.cards[pool[Math.floor(Math.random() * pool.length)]]
      holder.replaceChildren(h('h3', {}, '用这个，说一句你自己的事：'), h('p', { class: 'big-number', style: 'font-size:34px;margin:8px 0', lang: 'en' }, card.text), h('p', {}, card.zh),
        h('p', { class: 'quote', lang: 'en', style: 'margin-top:12px' }, card.en.slice(0, card.r[0]), h('mark', {}, card.en.slice(card.r[0], card.r[1])), card.en.slice(card.r[1])), h('p', {}, card.szh))
      ctx.audio.pop()
    }
    next()
    ctx.ui.openDrawer({ kicker: '给你一个开口的由头', title: '今天说什么', sub: '不会说就照着课文那句，换掉两个词。说出声才算数。', app, body: [holder, h('button', { class: 'button', type: 'button', onclick: next }, '换一个')] })
  }
  function update(dt, time) { head.rotation.y = Math.sin(time * 0.9) * 0.35; head.position.y = 2.05 + Math.sin(time * 2.2) * 0.04 }
  return { node, height: 3.6, size: 1.0, hint: '出一道开口题', open, update }
}
