// 走进一栋房子：这个单元的十课
import { GENRES, h, stars } from './core.js'

export function openUnit(ctx, house) {
  const unit = house.unit
  const next = ctx.state.next()
  const lit = unit.lessons.filter(lesson => ctx.state.stars(lesson.id)).length
  const rows = unit.lessons.map(lesson => {
    const count = ctx.state.stars(lesson.id)
    return h('button', { class: `lesson${count ? ' is-done' : ''}${lesson.id === next.id ? ' is-next' : ''}`, type: 'button', onclick: () => ctx.openLesson(lesson) },
      h('b', {}, String(lesson.n)),
      h('div', {}, h('strong', { lang: 'en' }, lesson.title), h('small', {}, `${GENRES[lesson.genre] ?? lesson.genre} · ${Math.max(1, Math.round(lesson.seconds / 60))} 分钟 · ${lesson.cards.length} 张卡`)),
      stars(count))
  })
  ctx.ui.openDrawer({
    kicker: `单元 ${unit.n} · ${unit.en}`,
    title: unit.zh,
    sub: unit.summary,
    body: [h('div', {}, h('p', { class: 'note' }, `亮了 ${lit} / ${unit.lessons.length} 盏灯`), h('div', { class: 'bar lime' }, h('i', { style: `width:${lit / unit.lessons.length * 100}%` }))), h('div', { class: 'lessons' }, rows)],
  })
}
