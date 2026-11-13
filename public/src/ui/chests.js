// 宝箱打开是一张卡：图标、一句介绍、去 App Store。另有一张清单，看找到了哪些
import { WHEN } from '../world/chests.js'
import { h } from './core.js'

export function openChestCard(ctx, app, count, fresh) {
  ctx.ui.openDrawer({
    kicker: fresh ? `找到了！第 ${count} / ${ctx.chests.chests.length} 只` : '我做的 App',
    title: app.zh === app.en ? app.zh : `${app.zh} ${app.en}`,
    body: h('div', { class: 'appshow' },
      h('img', { src: app.icon, alt: '', width: 120, height: 120 }),
      h('p', { class: 'appshow-line' }, app.tagline),
      h('a', { class: 'button big', href: app.store, target: '_blank', rel: 'noopener' }, 'App Store'),
      h('button', { class: 'chip', type: 'button', onclick: () => openChestList(ctx) }, '看看找到了哪些')),
  })
}

export function openChestList(ctx) {
  const { chests } = ctx.chests
  const found = chest => Boolean(ctx.state.town.chests[chest.app.id])
  const tile = chest => found(chest)
    ? h('button', { class: 'chest-tile is-found', type: 'button', onclick: () => openChestCard(ctx, chest.app, ctx.chests.found(), false) }, h('img', { src: chest.app.icon, alt: '', width: 56, height: 56 }), h('span', {}, chest.app.zh))
    : h('div', { class: 'chest-tile' }, h('b', {}, '?'), h('span', {}, chest.when ? WHEN[chest.when] : '还没找到'))
  ctx.ui.openDrawer({
    kicker: '林子里藏着我做的 App', title: `宝箱 ${ctx.chests.found()} / ${chests.length}`,
    sub: '沿着小路、木屋后面、溪边都找找。有三只挑时候才出现：夜里、下雨天、冬天。',
    body: h('div', { class: 'chest-grid' }, chests.map(tile)),
  })
}
