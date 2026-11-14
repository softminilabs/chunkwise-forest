// 顶上右边几个入口（都是能点开的：水滴、我种的、宝箱、声音、森林、语言），底下三个不用走路的按钮：接着学、练一练、听单词。
// 走路是为了好玩，不是门槛：想学的时候一步都不用走
import { openChestList } from './chests.js'
import { cycles, marks, openDay, percent } from './day.js'
import { SEASON_NAMES } from '../look.js'
import { h } from './core.js'
import { openMap } from './map.js'
import { openScene } from './scene.js'
import { openSounds } from './sounds.js'
import { lang, setLang, t } from '../i18n.js'

/// 「组块森林」牌子下面单独的一张小牌：今天已过百分之几，底下一排 24 格。点开是右边的侧栏（ui/day.js）
function dayCard(ctx) {
  const card = h('button', { class: 'day sticker', type: 'button', onclick: () => openDay(ctx) })
  const paint = () => {
    const [today] = cycles()
    card.replaceChildren(h('span', {}, t('今天已过'), h('strong', {}, percent(today.part))), marks(today.done, today.total))
  }
  paint()
  setInterval(paint, 60000)
  return card
}

export function createHud(ctx) {
  const hud = document.querySelector('.hud')
  const stats = hud.querySelector('.stats')
  const dock = document.querySelector('.dock')
  const go = h('button', { class: 'go', type: 'button', onclick: () => ctx.continueLearning() })
  const drill = h('button', { class: 'go light', type: 'button', onclick: () => ctx.openPractice() })
  // 听单词不用进单词屋就能开：闭着眼听的东西，走一趟路没必要
  const listen = h('button', { class: 'go light', type: 'button', onclick: () => ctx.lodge.listenOutside() }, h('div', {}, t('听单词')))
  const chests = h('button', { class: 'stat', type: 'button', onclick: () => openChestList(ctx) })
  const planted = h('button', { class: 'stat', type: 'button', onclick: () => openMap(ctx) })
  const sounds = h('button', { class: 'stat', type: 'button', onclick: () => openSounds(ctx) }, t('声音'))
  const scene = h('button', { class: 'stat', type: 'button', onclick: () => openScene(ctx) }, t('森林'))
  // 换语言是整页重载。记一笔「已经进了森林」，重载回来就不再停在开场那张卡片上
  const other = lang === 'zh' ? 'en' : 'zh'
  const tongue = h('button', { class: 'stat', type: 'button', 'aria-label': other === 'en' ? 'Switch to English' : '切换到中文', onclick: () => { sessionStorage.setItem('cw.resume', '1'); setLang(other) } }, other === 'en' ? 'EN' : '中文')
  dock.replaceChildren(h('div', { class: 'row center' }, go, drill, listen), dock.querySelector('.keys'))
  hud.querySelector('.hud-left').append(dayCard(ctx))
  stats.replaceChildren(ctx.water.chip(), planted, chests, sounds, scene, tongue)

  function paint() {
    const totals = ctx.state.totals()
    const due = ctx.state.due().length
    const next = ctx.state.next()
    // 「森林」按钮上直接写着现在是什么季节、白天还是夜里
    const season = SEASON_NAMES[ctx.weather.now.season]
    scene.replaceChildren(t('森林'), h('strong', {}, ctx.weather.dark ? t('{season}夜', { season }) : season))
    chests.replaceChildren(t('宝箱'), h('strong', {}, `${ctx.chests.found()}/${ctx.chests.chests.length}`))
    planted.replaceChildren(t('我种的'), h('strong', {}, String(ctx.garden.store.done.filter(item => item.slot != null).length)))
    go.replaceChildren(h('span', {}, '▶'), h('div', {}, totals.lit ? t('接着学') : t('开始第一课'), h('small', {}, ` ${t('第 {n} 课 · {title}', { n: next.n, title: next.title })}`)))
    drill.replaceChildren(h('div', {}, t('练一练'), h('small', {}, ` ${totals.cards < 4 ? t('读完一课解锁') : due ? t('{n} 张该复习', { n: due }) : t('随便玩一轮')}`)))
  }

  ctx.state.on(paint)
  ctx.garden.on(paint)
  ctx.weather.onChange(paint)
  paint()
  return { paint, show() { hud.hidden = false; dock.hidden = false } }
}
