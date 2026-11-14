// 选种子：头一回进单词屋、或者花盆空着的时候出来。上面一排种子，点哪一颗，中间就摆出它从种子到长成的五个样子，最底下把它种下去。
// 还没做模型的也摆在这一排，标着「建设中」：点得中、看得到要几滴，种不了
import { h } from './core.js'
import { t } from '../i18n.js'
import { LESSON_DROPS, WORD_DROPS } from '../garden.js'
import { PLANNED, PLANTS, plantName } from '../world/plants/index.js'
import { dropsFor } from '../world/plants/stages.js'
import { portrait } from '../world/portrait.js'

const STAGES = [t('种子'), t('芽'), t('小苗'), t('小树'), t('长成')]
// 还没做模型的种子拍不了照：让拍照的那只花盆种一个什么都不长的，拍下来就是一只空花盆
const EMPTY = { id: 'empty', build: () => null }

const ready = plant => plant.id in PLANTS
const drops = n => h('small', {}, t('{n} 滴', { n }))
const shot = (plant, stage) => h('img', { src: portrait(plant, stage).toDataURL(), alt: '' })

/// 上面那一排里的一格
const tile = (plant, pick) => h('button', { class: ready(plant) ? 'seed' : 'seed is-soon', type: 'button', onclick: pick },
  ready(plant) ? shot(plant, 4) : [shot(EMPTY, 0), h('em', {}, t('建设中'))],
  h('strong', {}, plantName(plant.id)), drops(plant.drops))

/// 选中的那一种：能种的摆出从种子到长成的五个样子、各要浇到几滴；还没做的只有一只空花盆和一句话
const preview = plant => ready(plant)
  ? h('div', { class: 'seed-steps' }, STAGES.map((name, k) => h('figure', {}, shot(plant, k), h('figcaption', {}, name, drops(dropsFor(k, plant.drops))))))
  : h('figure', { class: 'seed-soon' }, shot(EMPTY, 0), h('figcaption', {}, t('{name}还在做，做好了就能种。', { name: plantName(plant.id) })))

/// sown：种下之后要做的事
export function openSeeds(ctx, sown) {
  const plants = [...Object.values(PLANTS), ...PLANNED]
  let chosen = plants[0]
  const sow = () => { ctx.garden.sow(chosen.id); ctx.audio.pop(); ctx.ui.closeModal(); sown?.() }
  const grow = h('div', { class: 'seed-grow' }, preview(chosen))
  const go = h('button', { class: 'button big', type: 'button', onclick: sow }, t('种这一颗'))
  // 鼠标点完把焦点放掉：留着的话之后一按键盘，浏览器就给这一格描上键盘用的焦点圈。键盘回车选的（detail 是 0）不放
  const tiles = plants.map(plant => tile(plant, event => { choose(plant); if (event.detail) event.currentTarget.blur() }))
  tiles[0].classList.add('is-on')

  function choose(plant) {
    if (plant === chosen) return
    chosen = plant
    tiles.forEach((node, k) => node.classList.toggle('is-on', plants[k] === plant))
    go.disabled = !ready(plant)
    // 旧的那一块淡出去，新的叠在同一块地方淡进来；只写终点，正淡到一半的也从当时的深浅接着淡
    const old = grow.lastChild
    old.animate({ opacity: 0 }, { duration: 250, easing: 'ease-out' }).onfinish = () => old.remove()
    grow.append(preview(plant))
  }

  ctx.ui.openModal(h('section', { class: 'seeds sticker', 'aria-label': t('选一颗种子') },
    h('header', { class: 'drawer-head' },
      h('div', { class: 'grow' }, h('h2', {}, t('选一颗种子')), h('p', {}, t('学完一个词得 {a} 滴水，听完一课得 {b} 滴。浇够了它就长成，种进林子里。', { a: WORD_DROPS, b: LESSON_DROPS }))),
      h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
    h('div', { class: 'seeds-body' }, h('div', { class: 'seeds-row' }, tiles), grow),
    go))
}
