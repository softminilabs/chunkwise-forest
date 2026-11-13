// 顶上几个数和入口，底下两个不用走路的按钮：接着学、练一练。
// 走路是为了好玩，不是门槛：想学的时候一步都不用走
import { openChestList } from './chests.js'
import { SEASON_NAMES } from '../look.js'
import { h } from './core.js'
import { openScene } from './scene.js'
import { openSounds } from './sounds.js'
import { lang, setLang, t } from '../i18n.js'

export function createHud(ctx) {
  const hud = document.querySelector('.hud')
  const stats = hud.querySelector('.stats')
  const dock = document.querySelector('.dock')
  const go = h('button', { class: 'go', type: 'button', onclick: () => ctx.continueLearning() })
  const drill = h('button', { class: 'go light', type: 'button', onclick: () => ctx.openPractice() })
  const chests = h('button', { class: 'stat', type: 'button', onclick: () => openChestList(ctx) })
  const sounds = h('button', { class: 'stat', type: 'button', onclick: () => openSounds(ctx) }, t('声音'))
  const scene = h('button', { class: 'stat', type: 'button', onclick: () => openScene(ctx) }, t('森林'))
  // 换语言是整页重载。记一笔「已经进了森林」，重载回来就不再停在开场那张卡片上
  const other = lang === 'zh' ? 'en' : 'zh'
  const tongue = h('button', { class: 'stat', type: 'button', 'aria-label': other === 'en' ? 'Switch to English' : '切换到中文', onclick: () => { sessionStorage.setItem('cw.resume', '1'); setLang(other) } }, other === 'en' ? 'EN' : '中文')
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
    const season = SEASON_NAMES[ctx.weather.now.season]
    scene.replaceChildren(t('森林'), h('strong', {}, ctx.weather.dark ? t('{season}夜', { season }) : season))
    chests.replaceChildren(t('宝箱'), h('strong', {}, `${ctx.chests.found()}/${ctx.chests.chests.length}`))
    stats.replaceChildren(stat('streak', t('连续'), streak, t('天', { n: streak }), streak > 0), stat('lit', t('亮灯'), `${totals.lit}/${totals.lessons}`, ''), stat('cards', t('卡片'), totals.cards, t('张')), chests, sounds, scene, tongue)
    go.replaceChildren(h('span', {}, '▶'), h('div', {}, totals.lit ? t('接着学') : t('开始第一课'), h('small', {}, ` ${t('第 {n} 课 · {title}', { n: next.n, title: next.title })}`)))
    drill.replaceChildren(h('div', {}, t('练一练'), h('small', {}, ` ${totals.cards < 4 ? t('读完一课解锁') : due ? t('{n} 张该复习', { n: due }) : t('随便玩一轮')}`)))
  }

  ctx.state.on(paint)
  ctx.weather.onChange(paint)
  paint()
  return { paint, show() { hud.hidden = false; dock.hidden = false } }
}
