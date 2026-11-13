// 「今天」面板：这一天过到哪了、今天该学的做了多少，都画成一格一格。
// 画法是岁时（我的另一款 App）的：过去的墨色，此刻一笔朱红，还没到的浅灰
import { h } from './core.js'
import { lang, t } from '../i18n.js'

/// 一排格子：前 done 格是墨色，紧接着的那一格是朱红，其余浅灰；做满了就没有朱红
const marks = (done, total) => h('div', { class: 'marks', role: 'img', 'aria-label': `${done} / ${total}` },
  Array.from({ length: total }, (_, k) => h('i', { class: k < done ? 'is-past' : k === done ? 'is-now' : '' })))

export function openToday(ctx) {
  const now = new Date()
  const mission = ctx.state.mission()
  const rows = [
    [t('这一天'), marks(now.getHours(), 24)],
    [t('读 {n} 课', { n: mission.goal }), marks(mission.lessons, mission.goal)],
    [t('答对 {n} 张', { n: mission.rightGoal }), marks(mission.right, mission.rightGoal)],
  ]
  ctx.ui.openDrawer({
    kicker: now.toLocaleDateString(lang === 'en' ? 'en-GB' : 'zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
    title: t('今天'),
    body: h('div', { class: 'drawer-rows' }, rows.map(([label, row]) => h('div', {}, h('p', { class: 'kicker' }, label), row))),
    app: ctx.apps.find(app => app.id === 'sundial'),
  })
}
