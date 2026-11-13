// 顶上的三个数、底下两个不用走路的按钮：接着学、练一练。
// 走路是为了好玩，不是门槛：想学的时候一步都不用走
import { h } from './core.js'

export function createHud(ctx) {
  const hud = document.querySelector('.hud')
  const stats = hud.querySelector('.stats')
  const dock = document.querySelector('.dock')
  const go = h('button', { class: 'go', type: 'button', onclick: () => ctx.continueLearning() })
  const drill = h('button', { class: 'go light', type: 'button', onclick: () => ctx.openPractice() })
  const sound = h('button', { class: 'stat', type: 'button', onclick: () => { ctx.state.patch({ sound: !ctx.state.town.sound }); ctx.audio.setSound(ctx.state.town.sound) } })
  const LIGHTS = [['auto', '天色 跟时间'], ['day', '天色 白天'], ['night', '天色 夜晚']]
  const light = h('button', { class: 'stat', type: 'button', onclick: () => { const k = LIGHTS.findIndex(([id]) => id === (ctx.state.town.light ?? 'auto')); ctx.state.patch({ light: LIGHTS[(k + 1) % LIGHTS.length][0] }); ctx.applyLight() } })
  const shown = {}
  dock.replaceChildren(h('div', { class: 'row center' }, go, drill), dock.querySelector('.keys'))

  function stat(key, label, value, unit, hot) {
    const node = h('div', { class: `stat${hot ? ' is-hot' : ''}${shown[key] !== undefined && shown[key] !== value ? ' is-bump' : ''}` }, label, h('strong', {}, String(value)), unit)
    shown[key] = value
    return node
  }

  function paint() {
    const totals = ctx.state.totals()
    const streak = ctx.state.streak()
    const due = ctx.state.due().length
    const next = ctx.state.next()
    sound.textContent = ctx.state.town.sound ? '声音 开' : '声音 关'
    sound.setAttribute('aria-pressed', String(ctx.state.town.sound))
    light.textContent = LIGHTS.find(([id]) => id === (ctx.state.town.light ?? 'auto'))[1]
    stats.replaceChildren(stat('streak', '连续', streak, '天', streak > 0), stat('lit', '亮灯', `${totals.lit}/${totals.lessons}`, ''), stat('cards', '卡片', totals.cards, '张'), light, sound)
    go.replaceChildren(h('span', {}, '▶'), h('div', {}, totals.lit ? '接着学' : '开始第一课', h('small', {}, ` 第 ${next.n} 课 · ${next.title}`)))
    drill.replaceChildren(h('div', {}, '练一练', h('small', {}, totals.cards < 4 ? ' 读完一课解锁' : due ? ` ${due} 张该复习` : ' 随便玩一轮')))
  }

  ctx.state.on(paint)
  paint()
  return { paint, show() { hud.hidden = false; dock.hidden = false } }
}
