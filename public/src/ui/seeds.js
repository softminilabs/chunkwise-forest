// 选种子：头一回进单词屋、或者花盆空着的时候出来。每种种子摆出它从种子到长成的五个样子，各要浇到几滴
import { h } from './core.js'
import { t } from '../i18n.js'
import { LESSON_DROPS, WORD_DROPS } from '../garden.js'
import { PLANTS } from '../world/plants/index.js'
import { dropsFor } from '../world/plants/stages.js'
import { portrait } from '../world/portrait.js'

const NAMES = { pine: t('松树'), peach: t('桃花') }
const STAGES = [t('种子'), t('芽'), t('小苗'), t('小树'), t('长成')]
export const plantName = id => NAMES[id]

/// 一种种子：整块都能点。sown：种下之后要做的事
function seed(ctx, plant, sown) {
  const sow = () => { ctx.garden.sow(plant.id); ctx.audio.pop(); ctx.ui.closeModal(); sown?.() }
  return h('button', { class: 'seed', type: 'button', onclick: sow },
    h('div', { class: 'seed-head' }, h('strong', {}, plantName(plant.id)), h('span', {}, t('一共要 {n} 滴水', { n: plant.drops })), h('i', {}, t('种这一颗'))),
    h('div', { class: 'seed-steps' }, STAGES.map((name, k) => h('figure', {},
      h('img', { src: portrait(plant, k).toDataURL(), alt: '' }),
      h('figcaption', {}, name, h('small', {}, t('{n} 滴', { n: dropsFor(k, plant.drops) })))))))
}

export function openSeeds(ctx, sown) {
  ctx.ui.openModal(h('section', { class: 'seeds sticker', 'aria-label': t('选一颗种子') },
    h('header', { class: 'drawer-head' },
      h('div', { class: 'grow' }, h('h2', {}, t('选一颗种子')), h('p', {}, t('学完一个词得 {a} 滴水，听完一课得 {b} 滴。浇够了它就长成，挂到荣誉墙上。', { a: WORD_DROPS, b: LESSON_DROPS }))),
      h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
    h('div', { class: 'seeds-list' }, Object.values(PLANTS).map(plant => seed(ctx, plant, sown)))))
}
