// 宝箱打开是一张卡：图标、一句介绍、去 App Store。另有一张清单，看找到了哪些
import { WHEN } from '../world/chests.js'
import { appName, h } from './core.js'
import { pick, t } from '../i18n.js'

export function openChestCard(ctx, app, count, fresh) {
  ctx.ui.openDrawer({
    kicker: fresh ? t('找到了！第 {n} / {total} 只', { n: count, total: ctx.chests.chests.length }) : t('我做的 App'),
    title: appName(app),
    body: h('div', { class: 'appshow' },
      h('img', { src: app.icon, alt: '', width: 120, height: 120 }),
      h('p', { class: 'appshow-line' }, pick(app, 'tagline', 'taglineEn')),
      h('a', { class: 'button big', href: app.store, target: '_blank', rel: 'noopener' }, 'App Store'),
      h('button', { class: 'chip', type: 'button', onclick: () => openChestList(ctx) }, t('看看找到了哪些'))),
  })
}

export function openChestList(ctx) {
  const { chests } = ctx.chests
  const found = chest => Boolean(ctx.state.town.chests[chest.app.id])
  const tile = chest => found(chest)
    ? h('button', { class: 'chest-tile is-found', type: 'button', onclick: () => openChestCard(ctx, chest.app, ctx.chests.found(), false) }, h('img', { src: chest.app.icon, alt: '', width: 56, height: 56 }), h('span', {}, pick(chest.app)))
    : h('div', { class: 'chest-tile' }, h('b', {}, '?'), h('span', {}, chest.when ? WHEN[chest.when] : t('还没找到')))
  ctx.ui.openDrawer({
    kicker: t('林子里藏着我做的 App'), title: t('宝箱 {n} / {total}', { n: ctx.chests.found(), total: chests.length }),
    sub: t('沿着小路、木屋后面、溪边都找找。有三只挑时候才出现：夜里、雨雪天、冬天。'),
    body: h('div', { class: 'chest-grid' }, chests.map(tile)),
  })
}
