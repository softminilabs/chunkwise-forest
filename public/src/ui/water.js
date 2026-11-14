// 水滴在界面上的三样东西：顶上的计数（点开是说明）、得到水滴时冒出来的提示、听完一课盖上来的那一层「收下」。
// 水滴怎么来、能拿来干什么，都从这里告诉人
import { h } from './core.js'
import { t } from '../i18n.js'
import { LESSON_DROPS, WORD_DROPS } from '../garden.js'
import { plantName } from '../world/plants/index.js'

const drop = () => h('i', { class: 'drop' })
const wait = ms => new Promise(done => setTimeout(done, ms))
// 画出来的水壶，颜色照屋里那只（world/pot.js）：蓝壶身、米白的边、铜的莲蓬头。prize-mouth 是壶口，水滴往它那儿落
const CAN = `<svg viewBox="0 0 200 150" aria-hidden="true">
  <path d="M62 72C26 72 26 120 62 120" fill="none" stroke="#F3EFE4" stroke-width="8" stroke-linecap="round"/>
  <path d="M132 98L176 50L187 60L140 120Z" fill="#4E7FA8"/>
  <rect x="169" y="43" width="28" height="13" rx="4" fill="#E9B949" transform="rotate(45 183 50)"/>
  <path d="M64 58H136L141 126Q141 135 132 135H68Q59 135 59 126Z" fill="#4E7FA8"/>
  <rect x="55" y="128" width="90" height="9" rx="4.5" fill="#F3EFE4"/>
  <rect x="59" y="54" width="82" height="9" rx="4.5" fill="#F3EFE4"/>
  <g class="prize-lid"><rect x="62" y="44" width="76" height="11" rx="5.5" fill="#3F6C93"/><circle cx="100" cy="42" r="6" fill="#F3EFE4"/></g>
  <circle class="prize-mouth" cx="100" cy="56" r="1" fill="none"/>
</svg>`

export function createWater(ctx) {
  const { garden } = ctx
  // 计数可能同时摆在好几处（森林顶栏、屋里顶栏、书桌那张纸上面），不记名单，直接在页面上找
  const chips = () => document.querySelectorAll('.water')
  garden.on(() => { for (const chip of chips()) chip.lastChild.textContent = String(garden.store.water) })

  function explain() {
    const { store } = garden
    const plant = store.seed ? t('{name}浇了 {a} / {b} 滴', { name: plantName(store.seed), a: store.poured, b: garden.need }) : t('花盆还空着，进单词屋选一颗种子')
    ctx.ui.openDrawer({
      kicker: t('水滴'), title: t('壶里有 {n} 滴水', { n: store.water }),
      sub: t('到单词屋的花盆前浇水，种的东西就长大；长成了种进林子里。'),
      body: [
        h('div', { class: 'water-rules' },
          h('div', {}, h('span', {}, t('学完一个词')), h('b', {}, drop(), `+${WORD_DROPS}`)),
          h('div', {}, h('span', {}, t('听完一课')), h('b', {}, drop(), `+${LESSON_DROPS}`))),
        h('p', { class: 'note' }, plant),
        !ctx.lodge.inside && h('button', { class: 'button big', type: 'button', onclick: () => { ctx.ui.closeDrawer(); ctx.lodge.enter() } }, t('去单词屋')),
      ],
    })
  }

  /// 一颗计数：水滴图标和壶里的滴数
  const chip = () => h('button', { class: 'stat water', type: 'button', 'aria-label': t('水滴'), onclick: explain }, drop(), h('strong', {}, String(garden.store.water)))

  /// 计数旁边冒一个「+1 滴水」，往上飘着淡掉
  function float(chip, drops) {
    const box = chip.getBoundingClientRect()
    const note = h('span', { class: 'water-plus', style: `left:${box.left + box.width / 2}px;top:${box.bottom + 6}px` }, drop(), t('+{n} 滴水', { n: drops }))
    document.body.append(note)
    note.animate({ opacity: [0, 1, 1, 0], translate: ['-50% 10px', '-50% 0', '-50% -2px', '-50% -14px'], offset: [0, 0.15, 0.7, 1] }, { duration: 1500, easing: 'ease-out' }).onfinish = () => note.remove()
    chip.animate({ scale: [1, 1.22, 1] }, { duration: 380, easing: 'ease-out' })
  }

  /// 一滴水落进壶口：壶身压一下弹回来，溅起两小滴
  function land(card, can, mouth) {
    can.firstElementChild.animate({ transform: ['scale(1)', 'scale(1.07, .9)', 'scale(.97, 1.05)', 'scale(1)'] }, { duration: 340, easing: 'ease-out' })
    const base = card.getBoundingClientRect()
    for (const side of [-1, 1]) {
      const bit = h('i', { class: 'drop prize-splash', style: `left:${mouth.left - base.left}px;top:${mouth.top - base.top}px` })
      card.append(bit)
      bit.animate([{ translate: '-50% 0', opacity: 1 }, { translate: `calc(-50% + ${side * 20}px) -26px`, opacity: 1, offset: 0.45 }, { translate: `calc(-50% + ${side * 34}px) 6px`, opacity: 0 }], { duration: 440, easing: 'ease-out' }).onfinish = () => bit.remove()
    }
  }

  /// 点了「收下」：壶盖掀开，水一滴一滴落进去，壶里的数跟着走；落完盖上盖子，这一层淡掉
  async function collect(layer, { card, drips, can, count, before }) {
    layer.classList.add('is-taking')
    await wait(280)
    const mouth = can.querySelector('.prize-mouth').getBoundingClientRect()
    await Promise.all(drips.map((drip, k) => {
      const box = drip.getBoundingClientRect()
      const dx = mouth.left - box.left - box.width / 2
      const dy = mouth.top - box.top - box.height / 2
      // 先往上颠一下再掉下去，越掉越快
      drip.style.animation = 'none'
      const fall = drip.animate([{ translate: '0 0', scale: 1 }, { translate: `${dx * 0.3}px -22px`, scale: 1.08, offset: 0.28 }, { translate: `${dx}px ${dy}px`, scale: 0.32 }], { duration: 560, delay: k * 250, easing: 'cubic-bezier(.45, 0, .85, .45)', fill: 'both' })
      return fall.finished.then(() => {
        drip.style.visibility = 'hidden'
        ctx.audio.drop(k)
        count.textContent = t('壶里有 {n} 滴', { n: before + k + 1 })
        land(card, can, mouth)
      })
    }))
    layer.classList.replace('is-taking', 'is-full')
    ctx.audio.chime(3)
    await wait(700)
    await layer.animate({ opacity: [1, 0] }, { duration: 300, easing: 'ease-in' }).finished
    layer.remove()
  }

  /// 像过关一样盖上来的一层：几滴水、下面水壶、下面「收下」。水在这之前已经记过账了，这里只是让人亲手收一下。
  /// why：上面那行小字，说这几滴是怎么来的
  function prize(drops, why) {
    const before = garden.store.water - drops
    const drips = Array.from({ length: drops }, (_, k) => h('i', { class: 'drop', style: `--wait:${350 + k * 200}ms` }))
    const can = h('div', { class: 'prize-can', html: CAN })
    const count = h('span', { class: 'prize-count' }, t('壶里有 {n} 滴', { n: before }))
    const take = h('button', { class: 'button big', type: 'button' }, t('收下'))
    const card = h('div', { class: 'prize-card' },
      h('div', { class: 'prize-rays', 'aria-hidden': 'true' }),
      h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, k) => h('i', { style: `--a:${k * 26}deg;--d:${90 + (k % 4) * 28}px` }))),
      h('p', { class: 'prize-why' }, why), h('h2', {}, t('得到 {n} 滴水', { n: drops })),
      h('div', { class: 'prize-drops' }, drips), can, count, h('small', {}, t('水滴可以到单词屋给花盆浇水')), take)
    const layer = h('div', { class: 'prize' }, card)
    drips.forEach((_, k) => setTimeout(() => { if (layer.isConnected && !layer.classList.contains('is-taking')) ctx.audio.drop(k) }, 420 + k * 200))
    take.addEventListener('click', () => { take.disabled = true; collect(layer, { card, drips, can, count, before }) }, { once: true })
    return layer
  }

  return {
    chip, explain,
    /// 得到水滴：记账，露着的计数旁边提示一下
    gain(drops) {
      garden.earn(drops)
      ctx.audio.drop()
      for (const chip of chips()) if (chip.offsetParent) float(chip, drops)
    },
    prize,
  }
}
