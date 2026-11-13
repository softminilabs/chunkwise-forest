// 课文右边那一栏：这一课的卡片（组块和生词）。读到哪句，那句里的卡片亮起来；
// 点一张看解释，「听这句」跳到课文里它出现的地方。窄屏上它是从底下升起来的一层
import { h } from './core.js'
import { icon } from './reader-view.js'
import { t } from '../i18n.js'

function itemNode(ctx, card, onJump) {
  const owned = Boolean(ctx.state.town.cards[card.id])
  // 组块：英文释义 + 中文用法提示 + 例句；生词：一段中文讲解
  const lines = card.kind === 'word' ? [card.note && h('p', {}, card.note)] : [card.note && h('p', { lang: 'en' }, card.note), card.tip && h('p', {}, card.tip), card.example && h('p', { class: 'item-example', lang: 'en' }, card.example)]
  return h('div', { class: `item item-${card.kind}`, 'data-id': card.id, 'data-s': card.s, 'data-kind': card.kind },
    h('button', { class: 'item-head', type: 'button', 'aria-expanded': 'false' },
      h('span', { class: 'item-text' }, h('strong', { lang: 'en' }, card.text), card.pos && h('small', {}, card.pos)),
      h('span', { class: 'item-zh' }, card.zh),
      owned && h('i', { class: 'owned', title: t('已经收过了') }, icon('check'))),
    h('div', { class: 'item-detail', hidden: true }, ...lines, h('button', { class: 'chip', type: 'button', onclick: () => onJump(card.s) }, icon('play'), t('听这句'))))
}

export function buildSide(ctx, lesson, onJump) {
  const items = lesson.cards.map(card => itemNode(ctx, card, onJump))
  const list = h('div', { class: 'side-list' }, items)
  const counts = { all: items.length, chunk: lesson.cards.filter(card => card.kind === 'chunk').length, word: lesson.cards.filter(card => card.kind === 'word').length }
  const filters = h('div', { class: 'segment small', role: 'group', 'aria-label': t('筛选') }, [['all', t('全部')], ['chunk', t('组块')], ['word', t('生词')]].map(([id, label]) => h('button', { type: 'button', 'data-filter': id, class: id === 'all' ? 'is-on' : '' }, `${label} ${counts[id]}`)))
  const root = h('aside', { class: 'reader-side', 'aria-label': t('这一课的卡片') },
    h('header', { class: 'side-head' }, h('h3', {}, t('这一课的卡片')), h('button', { class: 'close only-narrow', type: 'button', 'aria-label': t('收起'), onclick: () => root.classList.remove('is-up') }, '✕')),
    filters, list)

  function open(id, on = true) {
    for (const item of items) {
      const match = item.dataset.id === id && on
      item.classList.toggle('is-open', match)
      item.querySelector('.item-detail').hidden = !match
      item.querySelector('.item-head').setAttribute('aria-expanded', String(match))
      if (match) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }
  list.addEventListener('click', event => {
    const head = event.target.closest('.item-head')
    if (head) open(head.parentNode.dataset.id, !head.parentNode.classList.contains('is-open'))
  })
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]')
    if (!button) return
    for (const other of filters.children) other.classList.toggle('is-on', other === button)
    for (const item of items) item.hidden = button.dataset.filter !== 'all' && item.dataset.kind !== button.dataset.filter
  })

  return {
    root, open,
    /// 窄屏：把这一栏升起来再展开那张卡
    reveal(id) { root.classList.add('is-up'); open(id) },
    /// 读到第 i 句：这句里的卡片亮起来，第一张滚到看得见的地方
    live(i) {
      let first = true
      for (const item of items) {
        const on = Number(item.dataset.s) === i
        item.classList.toggle('is-live', on)
        if (on && first && !item.hidden) { item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); first = false }
      }
    },
  }
}
