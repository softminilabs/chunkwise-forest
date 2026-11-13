// 顶上几个数和入口，底下两个不用走路的按钮：接着学、练一练。
// 走路是为了好玩，不是门槛：想学的时候一步都不用走
import { openChestList } from './chests.js'
import { SEASON_NAMES } from '../look.js'
import { h } from './core.js'
import { openScene } from './scene.js'
import { openSounds } from './sounds.js'

export function createHud(ctx) {
  const hud = document.querySelector('.hud')
  const stats = hud.querySelector('.stats')
  const dock = document.querySelector('.dock')
  const go = h('button', { class: 'go', type: 'button', onclick: () => ctx.continueLearning() })
  const drill = h('button', { class: 'go light', type: 'button', onclick: () => ctx.openPractice() })
  const chests = h('button', { class: 'stat', type: 'button', onclick: () => openChestList(ctx) })
  const sounds = h('button', { class: 'stat', type: 'button', onclick: () => openSounds(ctx) }, '声音')
  const scene = h('button', { class: 'stat', type: 'button', onclick: () => openScene(ctx) }, '森林')
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
    // 「森林」按钮上直接写着现在是什么季节、白天还是夜里
    scene.replaceChildren('森林', h('strong', {}, `${SEASON_NAMES[ctx.weather.now.season]}${ctx.weather.dark ? '夜' : ''}`))
    chests.replaceChildren('宝箱', h('strong', {}, `${ctx.chests.found()}/${ctx.chests.chests.length}`))
    stats.replaceChildren(stat('streak', '连续', streak, '天', streak > 0), stat('lit', '亮灯', `${totals.lit}/${totals.lessons}`, ''), stat('cards', '卡片', totals.cards, '张'), chests, sounds, scene)
    go.replaceChildren(h('span', {}, '▶'), h('div', {}, totals.lit ? '接着学' : '开始第一课', h('small', {}, ` 第 ${next.n} 课 · ${next.title}`)))
    drill.replaceChildren(h('div', {}, '练一练', h('small', {}, totals.cards < 4 ? ' 读完一课解锁' : due ? ` ${due} 张该复习` : ' 随便玩一轮')))
  }

  ctx.state.on(paint)
  ctx.weather.onChange(paint)
  paint()
  return { paint, show() { hud.hidden = false; dock.hidden = false } }
}
