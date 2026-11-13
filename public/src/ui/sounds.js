// 「声音」面板：每种声音一行，只有图标和名字，正在响的那几行是亮的。
// 平时跟着场景自动搭配（sounds.js）；点一下某一行就是单独把它打开或关掉
import { SOUNDS } from '../sounds.js'
import { h } from './core.js'
import { t } from '../i18n.js'

// 图标是番茄钟 App（ZenPomo）里那套声音图标，在 public/icons/sounds/。当遮罩用：颜色跟着文字色走，响和不响不用各备一张图
const icon = id => h('i', { class: 'sound-icon', style: `-webkit-mask-image:url(icons/sounds/${id}.svg);mask-image:url(icons/sounds/${id}.svg)` })

export function openSounds(ctx) {
  const list = h('div', { class: 'lessons' })
  // 改完等一小会儿再重画：音量是下一帧才算出来的
  const set = mix => { ctx.state.patch({ mix }); ctx.audio.tap(); setTimeout(paint, 60) }
  const reset = h('button', { class: 'chip', type: 'button', onclick: () => set({}) }, t('恢复自动搭配'))
  const paint = () => {
    // 手动开关过哪一种，才用得着「恢复自动搭配」
    reset.hidden = !Object.keys(ctx.state.town.mix).length
    list.replaceChildren(...Object.entries(SOUNDS).map(([id, [name]]) => {
      const live = ctx.sounds.levels[id] > 0.01
      return h('button', { class: `lesson sound-row${live ? ' is-done' : ''}`, type: 'button', 'aria-pressed': String(live), onclick: () => set({ ...ctx.state.town.mix, [id]: live ? 'off' : 'on' }) }, h('b', {}, icon(id)), h('strong', {}, name))
    }))
  }
  paint()
  const mute = h('button', { class: 'chip', type: 'button', onclick: () => { ctx.state.patch({ sound: !ctx.state.town.sound }); ctx.audio.setSound(ctx.state.town.sound); label() } })
  const label = () => { mute.textContent = ctx.state.town.sound ? t('全部静音') : t('打开声音'); mute.classList.toggle('is-on', !ctx.state.town.sound) }
  label()
  const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: ctx.state.town.volume, 'aria-label': t('环境声音量'), oninput: () => ctx.state.patch({ volume: Number(volume.value) }) })
  ctx.ui.openDrawer({
    kicker: t('学习时垫在底下的声音'), title: t('声音'), sub: t('跟着季节、昼夜和天气自动搭配，点一下单独开关。'),
    body: [h('div', {}, h('p', { class: 'note' }, t('环境声音量')), volume, h('div', { class: 'row' }, mute, reset)), list], app: ctx.apps.find(app => app.id === 'lull'),
  })
}
