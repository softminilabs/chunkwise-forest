// 走进一栋房子：这个单元的十课
import { GENRES, h, stars } from './core.js'
import { lang, pick, t } from '../i18n.js'

export function openUnit(ctx, house) {
  const unit = house.unit
  const next = ctx.state.next()
  const lit = unit.lessons.filter(lesson => ctx.state.stars(lesson.id)).length
  const rows = unit.lessons.map(lesson => {
    const count = ctx.state.stars(lesson.id)
    return h('button', { class: `lesson${count ? ' is-done' : ''}${lesson.id === next.id ? ' is-next' : ''}`, type: 'button', onclick: () => ctx.openLesson(lesson) },
      h('b', {}, String(lesson.n)),
      h('div', {}, h('strong', { lang: 'en' }, lesson.title), h('small', {}, t('{genre} · {min} 分钟 · {n} 张卡', { genre: GENRES[lesson.genre] ?? lesson.genre, min: Math.max(1, Math.round(lesson.seconds / 60)), n: lesson.cards.length }))),
      stars(count))
  })
  ctx.ui.openDrawer({
    // 中文界面里英文名放在小字那行；英文界面里英文名就是标题
    kicker: [t('单元 {n}', { n: unit.n }), lang === 'zh' && unit.en].filter(Boolean).join(' · '),
    title: pick(unit),
    sub: t(unit.summary),
    body: [h('div', {}, h('p', { class: 'note' }, t('亮了 {lit} / {total} 盏灯', { lit, total: unit.lessons.length })), h('div', { class: 'bar lime' }, h('i', { style: `width:${lit / unit.lessons.length * 100}%` }))), h('div', { class: 'lessons' }, rows)],
  })
}
