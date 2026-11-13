// 「今天已过 76%」那张小牌和它点开的侧栏：今天、本周、本月、今年各走到哪了，画成一格一格。
// 一格一格的画法借自岁时（我的另一款 App）；颜色用森林这套绿：过去的灰绿，此刻深一点，没到的很淡
import { h } from './core.js'
import { lang, t } from '../i18n.js'

const DAY = 86400000

/// 四个周期各走到哪了。total：画几格；done：已经过完几格（下一格就是此刻）；part：0–1 的进度
export function cycles(now = new Date()) {
  const inDay = (now - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY
  // 一周从周一算起
  const weekday = (now.getDay() + 6) % 7
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  return [
    { label: t('今天'), total: 24, done: now.getHours(), part: inDay },
    { label: t('本周'), total: 7, done: weekday, part: (weekday + inDay) / 7 },
    { label: t('本月'), total: monthDays, done: now.getDate() - 1, part: (now.getDate() - 1 + inDay) / monthDays },
    { label: t('今年'), total: 12, done: now.getMonth(), part: (now - yearStart) / (new Date(now.getFullYear() + 1, 0, 1) - yearStart) },
  ]
}

export const percent = part => `${Math.floor(part * 100)}%`

export const marks = (done, total) => h('div', { class: 'marks' }, Array.from({ length: total }, (_, k) => h('i', { class: k < done ? 'is-past' : k === done ? 'is-now' : '' })))

export function openDay(ctx) {
  const now = new Date()
  ctx.ui.openDrawer({
    title: now.toLocaleDateString(lang === 'en' ? 'en-GB' : 'zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
    body: h('div', { class: 'drawer-rows' }, cycles(now).map(item => h('div', { class: 'cycle' }, h('p', { class: 'kicker' }, item.label, h('span', {}, percent(item.part))), marks(item.done, item.total)))),
    app: ctx.apps.find(app => app.id === 'sundial'),
  })
}
