// 「我的 App」目录：15 款各在镇上哪儿、能干什么。点一个，直接把人带到它跟前
import { ZONES } from '../apps/index.js'
import { h } from './core.js'

export function openAppsList(ctx) {
  const things = ctx.things.list.filter(thing => thing.kind === 'app')
  const row = thing => h('button', { class: 'lesson app-row', type: 'button', onclick: () => ctx.visit(thing) },
    h('img', { src: thing.icon, alt: '', width: 34, height: 34 }), h('div', {}, h('strong', {}, thing.title), h('small', {}, thing.hint)), h('span', { class: 'go-see' }, '去看看'))
  ctx.ui.openDrawer({
    kicker: 'Softminilabs', title: '我的 App 都在镇上', sub: `${things.length} 款，每款在镇上是一样真能用的东西。点一个，直接带你过去。`,
    body: ZONES.map(([name, ids]) => h('div', {}, h('p', { class: 'kicker', style: 'margin-bottom:8px' }, name), h('div', { class: 'lessons' }, ids.map(id => things.find(thing => thing.id === id)).filter(Boolean).map(row)))),
  })
}
