// 跟声音有关的三样：收音机（眠静）、节拍器（节拍间歇）、大喇叭（啊啊啊）
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, ball, box, drum, flat, group, pill, toy } from '../toy.js'
import { h } from '../ui/core.js'

const BEDS = [['rain', '下雨'], ['waves', '海浪'], ['fire', '篝火'], ['night', '夏夜']]

function createRain(scene) {
  const COUNT = 220
  const points = new Float32Array(COUNT * 6)
  const drops = Array.from({ length: COUNT }, () => ({ x: (Math.random() - 0.5) * 70, y: Math.random() * 30, z: (Math.random() - 0.5) * 70, speed: 26 + Math.random() * 12 }))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }))
  lines.frustumCulled = false
  lines.visible = false
  scene.add(lines)
  return {
    lines,
    update(dt) {
      drops.forEach((drop, k) => {
        drop.y -= drop.speed * dt
        if (drop.y < 0) drop.y = 30
        points.set([drop.x, drop.y, drop.z, drop.x - 0.15, drop.y + 0.9, drop.z], k * 6)
      })
      geometry.attributes.position.needsUpdate = true
    },
  }
}

/// 眠静：选一种环境声陪你学。选了下雨，小镇真的会下雨
export function lull(ctx, app) {
  const antenna = toy(pill(0.04, 1.0), C.ink, { outline: 0.04 })
  antenna.rotation.z = -0.5
  const radio = group(toy(box(1.5, 1.0, 0.7, 0.2), C.violet, { outline: 0.1 }), at(toy(ball(0.3, 1), C.ink, { outline: 0 }), -0.32, 0, 0.26), at(toy(ball(0.12), C.lime, { outline: 0 }), 0.38, 0.18, 0.36), at(toy(ball(0.12), C.white, { outline: 0 }), 0.38, -0.18, 0.36), at(antenna, 0.7, 0.9, 0))
  const node = group(at(radio, 0, 0.62, 0), toy(drum(0.9, 1.0, 0.24, 0.1), C.white, { outline: 0.09 }))
  const rain = createRain(ctx.scene)
  function open() {
    const row = h('div', { class: 'row' })
    const paint = () => row.replaceChildren(...BEDS.map(([id, label]) => h('button', { class: `chip${ctx.audio.bed === id ? ' is-on' : ''}`, type: 'button', onclick: () => { ctx.audio.setBed(ctx.audio.bed === id ? null : id); paint() } }, label)))
    paint()
    ctx.ui.openDrawer({ kicker: '挑一种声音陪你学', title: '环境声', sub: '声音是现场合成的。再点一次同一个就关掉；选「下雨」，小镇会真的下起来。', app, body: [row, h('p', { class: 'note' }, '开着它去读课文也行：朗读的声音在上面，环境声垫在底下。')] })
  }
  function update(dt, time) {
    radio.rotation.z = ctx.audio.bed ? Math.sin(time * 9) * 0.03 : 0
    rain.lines.visible = ctx.audio.bed === 'rain'
    if (rain.lines.visible) rain.update(dt)
  }
  return { node, height: 2.4, size: 1.2, hint: '挑一种环境声', open, update }
}

/// 节拍间歇：节拍器。开着它，跟着拍子把刚读的句子念出来
export function cadence(ctx, app) {
  const arm = group(at(toy(pill(0.06, 1.7), C.ink, { outline: 0.05 }), 0, 0.9, 0), at(toy(ball(0.2), C.violet, { outline: 0.07 }), 0, 1.35, 0))
  const node = group(toy(drum(0.42, 1.05, 2.3, 0.14, 4), C.lime, { outline: 0.12 }), at(arm, 0, 0.5, 0.62))
  node.children[0].rotation.y = Math.PI / 4
  let bpm = 0
  let phase = 0
  let beat = 0
  function open() {
    const row = h('div', { class: 'row' })
    const paint = () => row.replaceChildren(...[[0, '停'], [60, '慢 60'], [90, '中 90'], [120, '快 120']].map(([value, label]) => h('button', { class: `chip${bpm === value ? ' is-on' : ''}`, type: 'button', onclick: () => { bpm = value; paint() } }, label)))
    paint()
    ctx.ui.openDrawer({ kicker: '跟着拍子练', title: '节拍器', sub: '英语是按重音打拍子的语言。开着它，把刚读过的句子一拍一个重音地念出来。', app, body: [row, h('p', { class: 'note' }, '每四拍第一下是高音。先用慢的，顺了再加快。')] })
  }
  function update(dt) {
    if (!bpm) { arm.rotation.z *= 0.9; return }
    phase += dt * bpm / 60 * Math.PI
    arm.rotation.z = Math.sin(phase) * 0.55
    const now = Math.floor(phase / Math.PI)
    if (now !== beat) { beat = now; ctx.audio.tick(beat % 4 === 0) }
  }
  return { node, height: 3.2, size: 1.1, hint: '跟着拍子念', open, update }
}

/// 啊啊啊：大喇叭。按住蓄力，松手把烦心事喊飞
export function ahhh(ctx, app, place) {
  const horn = toy(drum(1.05, 0.22, 1.9, 0.12), C.lime, { outline: 0.11 })
  horn.rotation.x = -1.15
  const rings = Array.from({ length: 3 }, () => { const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40), flat(C.white, { glow: true, transparent: true })); ring.visible = false; return ring })
  const node = group(toy(drum(1.5, 1.7, 0.35, 0.14), C.white, { outline: 0.11 }), at(toy(pill(0.12, 1.3), C.ink, { outline: 0.07 }), 0, 1.0, 0), at(horn, 0, 2.0, 0.3), ...rings.map(ring => at(ring, 0, 2.9, 2.4)))
  const WORDS = ['加班', '周一', 'deadline', '又忘了', '背不完', '考试', '听不懂', '好困']
  let blast = 0
  function shout(power) {
    blast = 1
    ctx.audio.whoosh(power)
    ctx.fx.burst(place.x, 3, place.z, 26, 1 + power)
    const layer = h('div', { class: 'shout', 'aria-hidden': 'true' }, WORDS.map((word, k) => h('b', { style: `--a:${k * 45 + 20}deg;--d:${(34 + power * 30).toFixed(0)}vmin;animation-delay:${k * 25}ms` }, word)))
    document.body.append(layer)
    setTimeout(() => layer.remove(), 1500)
  }
  function open() {
    const meter = h('i', { style: 'width:0%' })
    let since = 0
    let timer = 0
    const power = () => Math.min(1, (performance.now() - since) / 1400)
    const down = () => { since = performance.now(); timer = setInterval(() => { meter.style.width = `${power() * 100}%` }, 40) }
    const up = () => { if (!since) return; clearInterval(timer); shout(power()); since = 0; meter.style.width = '0%' }
    const button = h('button', { class: 'button big dark', type: 'button', onpointerdown: down, onpointerup: up, onpointerleave: up, onkeydown: event => { if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) down() }, onkeyup: up }, '按住，喊！')
    ctx.ui.openDrawer({ kicker: '喊出来就好了', title: '呐喊台', sub: '答错了、背不完、不想学了——按住蓄力，松手把它们喊飞。', app, body: [h('div', { class: 'bar lime' }, meter), button, h('p', { class: 'note' }, '按得越久，喊得越远。喊完回去接着学。')], onClose: () => clearInterval(timer) })
  }
  function update(dt) {
    if (blast <= 0) return
    blast -= dt * 1.1
    rings.forEach((ring, k) => {
      const t = Math.min(1, Math.max(0, (1 - blast) * 1.5 - k * 0.18))
      ring.visible = blast > 0 && t > 0
      ring.scale.setScalar(0.6 + t * 4.5)
      ring.position.z = 2.4 + t * 5
      ring.material.opacity = 1 - t
    })
  }
  return { node, height: 3.6, size: 1.8, hint: '把烦心事喊飞', open, update }
}
