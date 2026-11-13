// 节日倒计时的小卡片：离圣诞节、离春节还有几天。
// 卡片底下是念念——我那款专门记日子、算「还有多少天」的 App，公历农历都记
import { h } from './core.js'
import { lang, t } from '../i18n.js'

const DAY = 86400000
const midnight = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
// 一天不总是 24 小时（夏令时），所以四舍五入
export const daysUntil = (day, today = midnight()) => Math.round((day - today) / DAY)

/// 下一个圣诞节；今天就是的话返回今天
export function christmas(today = midnight()) {
  const day = new Date(today.getFullYear(), 11, 25)
  return day < today ? new Date(today.getFullYear() + 1, 11, 25) : day
}

// 春节是哪天查表，不现算：浏览器自带的农历在「朔」正好卡着北京时间午夜的年份会差一天
// ——2027 年它算成 2 月 7 日、2030 年算成 2 月 2 日，实际是 2 月 6 日和 2 月 3 日。其余年份我对过，两边一致
const SPRING = { 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19], 2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24], 2040: [2, 12] }

/// 下一个春节（农历正月初一）；今天就是的话返回今天。表里没有的年份（2040 年以后）才用浏览器的农历现算
export function springFestival(today = midnight()) {
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const day = SPRING[year] && new Date(year, SPRING[year][0] - 1, SPRING[year][1])
    if (day && day >= today) return day
  }
  const lunar = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' })
  for (let k = 0; k < 400; k++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + k)
    const parts = Object.fromEntries(lunar.formatToParts(day).map(part => [part.type, part.value]))
    if (parts.month === '1' && parts.day === '1') return day
  }
  return today
}

export const ICONS = {
  star: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l5.6 12.6 13.7 1.4-10.3 9.2 3 13.5L24 33.8 12 40.7l3-13.5L4.7 18l13.7-1.4z" fill="#E9B949"/></svg>',
  lantern: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3v6" stroke="#5B4334" stroke-width="2.5" stroke-linecap="round"/><rect x="17" y="8" width="14" height="4" rx="1.5" fill="#D9A531"/><ellipse cx="24" cy="23" rx="15" ry="12" fill="#C8372D"/><path d="M24 11.5v23M16.5 13.5c-3 6-3 13 0 19M31.5 13.5c3 6 3 13 0 19" stroke="#A52A22" stroke-width="1.6" fill="none"/><rect x="17" y="34" width="14" height="4" rx="1.5" fill="#D9A531"/><path d="M24 38v8M20.5 38v5.5M27.5 38v5.5" stroke="#D9A531" stroke-width="2" stroke-linecap="round"/></svg>',
}

/// festival：{ title, day, icon, note }。note 是日期后面补的一句（春节的「正月初一」）
export function openCountdown(ctx, { title, day, icon, note }) {
  const left = daysUntil(day)
  const date = day.toLocaleDateString(lang === 'en' ? 'en-GB' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  ctx.ui.openDrawer({
    kicker: [date, note].filter(Boolean).join(' · '),
    title,
    body: h('div', { class: 'countdown' }, h('span', { class: 'countdown-icon', html: icon }),
      left ? [h('small', {}, t('还有')), h('strong', {}, String(left)), h('small', {}, t('天', { n: left }))] : h('strong', { class: 'is-today' }, t('就是今天'))),
    app: ctx.apps.find(app => app.id === 'dontforget'),
  })
}
