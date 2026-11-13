// 「声音」面板：像眠静那样的小调音台。每种声音三档——自动（跟着场景）、常开、关
import { SOUNDS } from '../sounds.js'
import { h } from './core.js'

const MODES = ['auto', 'on', 'off']
const LABELS = { auto: '自动', on: '常开', off: '关' }

export function openSounds(ctx) {
  const list = h('div', { class: 'lessons' })
  const paint = () => list.replaceChildren(...Object.entries(SOUNDS).map(([id, [name]]) => {
    const mode = ctx.state.town.mix[id] ?? 'auto'
    const live = ctx.sounds.levels[id] > 0.01
    return h('button', { class: `lesson sound-row${live ? ' is-done' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ mix: { ...ctx.state.town.mix, [id]: MODES[(MODES.indexOf(mode) + 1) % MODES.length] } }); ctx.audio.tap(); setTimeout(paint, 60) } },
      h('b', {}, live ? '♪' : '·'), h('div', {}, h('strong', {}, name), h('small', {}, live ? '正在响' : '这会儿没有')), h('span', { class: 'go-see' }, LABELS[mode]))
  }))
  paint()
  const mute = h('button', { class: 'chip', type: 'button', onclick: () => { ctx.state.patch({ sound: !ctx.state.town.sound }); ctx.audio.setSound(ctx.state.town.sound); label() } })
  const label = () => { mute.textContent = ctx.state.town.sound ? '全部静音' : '打开声音'; mute.classList.toggle('is-on', !ctx.state.town.sound) }
  label()
  const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: ctx.state.town.volume, 'aria-label': '环境声音量', oninput: () => ctx.state.patch({ volume: Number(volume.value) }) })
  ctx.ui.openDrawer({
    kicker: '学习时垫在底下的声音', title: '声音', sub: '「自动」会跟着季节、昼夜、天气，还有你离篝火和小溪多远来配。点一下换成常开或关。',
    body: [h('div', {}, h('p', { class: 'note' }, '环境声音量'), volume, mute), list], app: ctx.apps.find(app => app.id === 'lull'),
  })
}
