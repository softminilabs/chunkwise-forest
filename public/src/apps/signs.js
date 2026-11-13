// 会亮、会显示东西的四样：LED 灯牌、路灯（补光灯）、二维码墙（码上美）和旁边的生成亭（二维码）
import * as THREE from 'three'
import qrcodeGenerator from 'qrcode'
import { C } from '../palette.js'
import { at, ball, box, canvasTexture, drum, flat, group, pill, toy } from '../toy.js'
import { h } from '../ui/core.js'

const ROWS = 22
const COLS = 110
const DOT = 8

/// 把一行字变成点阵：先用小字号画到一张小画布上，再逐像素读出哪些点该亮
function dotsOf(text) {
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const font = '700 19px "PingFang SC", "Microsoft YaHei", sans-serif'
  probe.font = font
  const width = Math.ceil(probe.measureText(text).width) + 2
  probe.canvas.width = width
  probe.canvas.height = ROWS
  probe.font = font
  probe.fillStyle = '#fff'
  probe.textBaseline = 'middle'
  probe.fillText(text, 1, ROWS / 2 + 1)
  const data = probe.getImageData(0, 0, width, ROWS).data
  return { width, lit: (x, y) => data[(y * width + x) * 4 + 3] > 110 }
}

function drawDots(context, dots, offset) {
  context.fillStyle = '#16141c'
  context.fillRect(0, 0, COLS * DOT, ROWS * DOT)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const source = Math.floor(x + offset)
    const on = source >= 0 && source < dots.width && dots.lit(source, y)
    context.fillStyle = on ? C.lime : '#2c2936'
    context.beginPath()
    context.arc(x * DOT + DOT / 2, y * DOT + DOT / 2, on ? 3.3 : 1.6, 0, Math.PI * 2)
    context.fill()
  }
}

/// 灯牌：滚动播今天的卡片。也可以自己写一句上屏
export function led(ctx, app) {
  const screen = canvasTexture(COLS * DOT, ROWS * DOT, () => {})
  const context = screen.image.getContext('2d')
  const node = group(at(toy(box(7.0, 1.9, 0.4, 0.22), C.ink, { outline: 0.13 }), 0, 3.0, 0), at(new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6 * ROWS / COLS), new THREE.MeshBasicMaterial({ map: screen })), 0, 3.0, 0.21),
    ...[-2.6, 2.6].map(x => at(toy(pill(0.12, 1.8), C.ink, { outline: 0.07 }), x, 1.05, 0)))
  let dots = null
  let offset = 0
  let turn = 0
  let frame = 0
  function nextText() {
    if (ctx.state.town.led) return ctx.state.town.led
    const owned = ctx.state.owned()
    const pool = owned.length ? owned : ctx.course.units[0].lessons[0].cards
    const card = ctx.cards[pool[turn++ % pool.length]]
    return `${card.text}  ${card.zh}`
  }
  function load() { dots = dotsOf(nextText()); offset = -COLS }
  function open() {
    const field = h('input', { class: 'field', type: 'text', maxlength: 40, placeholder: '写一句想举起来的话', value: ctx.state.town.led, 'aria-label': '灯牌上的字' })
    const show = () => { ctx.state.patch({ led: field.value.trim() }); load(); ctx.audio.pop() }
    field.addEventListener('keydown', event => { if (event.key === 'Enter') show() })
    ctx.ui.openDrawer({ kicker: '举起来的大字', title: 'LED 灯牌', sub: '平时它滚动播你收到的卡片。也可以写一句自己的话上屏。', app,
      body: [field, h('div', { class: 'row' }, h('button', { class: 'button', type: 'button', onclick: show }, '上屏'), h('button', { class: 'chip', type: 'button', onclick: () => { field.value = ''; show() } }, '换回今天的卡片'))] })
  }
  load()
  function update(dt) {
    offset += dt * 26
    if (offset > dots.width) load()
    // 点阵一秒画二十来次就够顺，不用每帧画两千多个点
    if (frame++ % 3 === 0) { drawDots(context, dots, offset); screen.needsUpdate = true }
  }
  return { node, height: 4.3, size: 1.2, hint: '写句话上屏', open, update }
}

const LAMPS = [['暖白', C.glow], ['荧光绿', C.lime], ['淡紫', '#E6D2FF'], ['粉', '#FFC4E6']]

/// 补光灯：镇上的路灯。换个颜色，天黑了全镇跟着变；应援模式会一起闪
export function ligit(ctx, app) {
  const glow = flat(LAMPS[ctx.state.town.lamp % LAMPS.length][1], { glow: true })
  const halo = new THREE.SpriteMaterial({ map: canvasTexture(128, 128, (context, size) => { const fill = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); fill.addColorStop(0, 'rgba(255,255,255,.9)'); fill.addColorStop(1, 'rgba(255,255,255,0)'); context.fillStyle = fill; context.fillRect(0, 0, size, size) }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const lamp = () => {
    const sprite = new THREE.Sprite(halo)
    sprite.scale.setScalar(4.2)
    return group(at(toy(pill(0.09, 3.0), C.ink, { outline: 0.07 }), 0, 1.6, 0), toy(drum(0.26, 0.4, 0.22, 0.08), C.ink, { outline: 0.07 }), at(new THREE.Mesh(ball(0.44), glow), 0, 3.45, 0), at(toy(drum(0.14, 0.5, 0.26, 0.09), C.ink, { outline: 0.07 }), 0, 3.74, 0), at(sprite, 0, 3.45, 0))
  }
  const node = lamp()
  // 另外三盏沿着 App 街立着
  for (const [x, z] of [[-2.3, 26], [2.3, 16], [-2.3, 16]]) { ctx.scene.add(at(lamp(), x, 0, z)); ctx.colliders.push({ x, z, r: 0.4 }) }
  let cheer = false
  function open() {
    const row = h('div', { class: 'row' })
    const paint = () => row.replaceChildren(...LAMPS.map(([label], k) => h('button', { class: `chip${ctx.state.town.lamp === k ? ' is-on' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ lamp: k }); glow.color.set(LAMPS[k][1]); paint() } }, label)),
      h('button', { class: `chip${cheer ? ' is-on' : ''}`, type: 'button', onclick: () => { cheer = !cheer; paint() } }, '应援模式'))
    paint()
    ctx.ui.openDrawer({ kicker: '屏幕补光 · 应援灯', title: '路灯的颜色', sub: '全镇的路灯一起换。白天不明显，天黑了最好看——去日晷那儿把时间拨到晚上试试。', app, body: [row] })
  }
  function update(dt, time) {
    const night = ctx.sky.state.night
    halo.opacity = (0.12 + night * 0.7) * (cheer ? 0.6 + Math.abs(Math.sin(time * 5)) * 0.6 : 1)
    halo.color.copy(glow.color)
  }
  return { node, height: 4.3, size: 0.4, hint: '给路灯换颜色', open, update }
}

const DEFAULT_QR = 'https://softminilabs.github.io/'
const STYLES = [['经典黑', C.ink, C.ink], ['紫', C.violetDeep, C.violet], ['紫配绿', C.violetDeep, C.limeDeep]]
const wall = { rebuild: () => {}, style: 0 }

function matrixOf(text) {
  const code = qrcodeGenerator(0, 'M')
  code.addData(text)
  code.make()
  const size = code.getModuleCount()
  return { size, dark: (row, column) => code.isDark(row, column) }
}

/// 一格什么颜色：三个定位角用深色，其余按风格。紫配绿里绿的只占少数，不然手机扫不出来
function tint(style, matrix, row, column) {
  const [, main, accent] = STYLES[style]
  const corner = (row < 7 && column < 7) || (row < 7 && column >= matrix.size - 7) || (row >= matrix.size - 7 && column < 7)
  return corner || (row * 7 + column * 3) % 5 ? main : accent
}

/// 面板里那张平的码：手机对着屏幕扫的是它，墙上的积木是摆着看的
function flatCode(text) {
  const matrix = matrixOf(text)
  const cell = Math.floor(520 / (matrix.size + 4))
  const canvas = h('canvas', { class: 'qr', width: cell * (matrix.size + 4), height: cell * (matrix.size + 4), role: 'img', 'aria-label': '二维码' })
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (let row = 0; row < matrix.size; row++) for (let column = 0; column < matrix.size; column++) {
    if (!matrix.dark(row, column)) continue
    context.fillStyle = tint(wall.style, matrix, row, column)
    context.beginPath()
    context.roundRect((column + 2) * cell + 0.5, (row + 2) * cell + 0.5, cell - 1, cell - 1, wall.style ? cell * 0.35 : 0)
    context.fill()
  }
  return canvas
}

/// 码上美：一面用积木拼的二维码墙，手机真能扫
export function mdqr(ctx, app) {
  const MAX = 45
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.5), new THREE.MeshToonMaterial({ color: 0xffffff }), MAX * MAX)
  const node = group(at(toy(box(4.8, 4.8, 0.36, 0.3), C.white, { outline: 0.13 }), 0, 2.9, 0), at(blocks, 0, 2.9, 0.2), ...[-1.6, 1.6].map(x => at(toy(pill(0.12, 0.5), C.ink, { outline: 0.07 }), x, 0.3, 0)))
  const matrix4 = new THREE.Matrix4()
  const color = new THREE.Color()
  wall.rebuild = () => {
    const matrix = matrixOf(ctx.state.town.qr || DEFAULT_QR)
    const cell = 4.1 / matrix.size
    let count = 0
    for (let row = 0; row < matrix.size; row++) for (let column = 0; column < matrix.size; column++) {
      if (!matrix.dark(row, column) || count >= MAX * MAX) continue
      matrix4.makeScale(cell * 0.92, cell * 0.92, 0.3).setPosition((column - matrix.size / 2 + 0.5) * cell, (matrix.size / 2 - row - 0.5) * cell, 0)
      blocks.setMatrixAt(count, matrix4)
      blocks.setColorAt(count++, color.set(tint(wall.style, matrix, row, column)))
    }
    blocks.count = count
    blocks.instanceMatrix.needsUpdate = true
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true
  }
  wall.rebuild()
  function open() {
    const code = () => flatCode(ctx.state.town.qr || DEFAULT_QR)
    const holder = h('div', { class: 'center' }, code())
    const row = h('div', { class: 'row center' })
    const paint = () => { row.replaceChildren(...STYLES.map(([label], k) => h('button', { class: `chip${wall.style === k ? ' is-on' : ''}`, type: 'button', onclick: () => { wall.style = k; wall.rebuild(); holder.replaceChildren(code()); paint() } }, label))) }
    paint()
    ctx.ui.openDrawer({ kicker: '好看到想分享的二维码', title: '扫一扫', sub: ctx.state.town.qr ? `现在码里装的是你写的：${ctx.state.town.qr}` : '拿手机扫这个码，能看到我做的全部 App。旁边的小亭子可以换成你自己的内容。', app, body: [holder, row] })
  }
  return { node, height: 5.6, size: 2.5, hint: '手机能扫的积木墙', open }
}

/// 二维码：墙边的生成亭。写个网址或一句话，墙上的码就换成你的
export function qrcode(ctx, app) {
  const node = group(at(toy(box(1.5, 2.2, 1.2, 0.26), C.violet, { outline: 0.12 }), 0, 1.1, 0), at(toy(box(1.0, 0.7, 0.14, 0.12), C.ink, { outline: 0 }), 0, 1.45, 0.62), at(toy(box(0.8, 0.14, 0.14, 0.05), C.lime, { outline: 0 }), 0, 0.85, 0.62), at(toy(box(1.7, 0.3, 1.4, 0.12), C.white, { outline: 0.1 }), 0, 2.35, 0))
  function open() {
    const field = h('input', { class: 'field', type: 'text', maxlength: 120, placeholder: '网址，或者一句话', value: ctx.state.town.qr, 'aria-label': '二维码里的内容' })
    const make = () => { ctx.state.patch({ qr: field.value.trim() }); wall.rebuild(); ctx.audio.chime(3); ctx.ui.toast(field.value.trim() ? '墙上的码换成<b>你的</b>了' : '墙上的码换回<b>默认</b>的了') }
    field.addEventListener('keydown', event => { if (event.key === 'Enter') make() })
    ctx.ui.openDrawer({ kicker: '生成 · 美化 · 扫码', title: '做一个你的码', sub: '写个网址或者一句话，旁边那面积木墙就拼成你的二维码。', app,
      body: [field, h('div', { class: 'row' }, h('button', { class: 'button', type: 'button', onclick: make }, '拼到墙上'), h('button', { class: 'chip', type: 'button', onclick: () => { field.value = ''; make() } }, '换回默认'))] })
  }
  return { node, height: 3.4, size: 1.1, hint: '把墙换成你的码', open }
}
