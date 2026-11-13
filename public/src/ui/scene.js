// 「森林」面板：季节、昼夜、天气。季节和昼夜默认跟着真实的日子和时间
import { SEASON_NAMES } from '../look.js'
import { h } from './core.js'

const ROWS = [
  ['season', '季节', [['auto', '跟着日子'], ...Object.entries(SEASON_NAMES)]],
  ['time', '昼夜', [['auto', '跟着时间'], ['day', '白天'], ['night', '夜晚']]],
  ['weather', '天气', [['clear', '晴'], ['rain', '下雨'], ['snow', '下雪'], ['meteor', '流星']]],
]

export function openScene(ctx) {
  const body = h('div', { class: 'drawer-rows' })
  const paint = () => body.replaceChildren(...ROWS.map(([key, label, options]) => h('div', {}, h('p', { class: 'kicker' }, label),
    h('div', { class: 'row' }, options.map(([value, text]) => h('button', { class: `chip${ctx.state.town.scene[key] === value ? ' is-on' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ scene: { ...ctx.state.town.scene, [key]: value } }); ctx.weather.resolve(); ctx.weather.repaint(); ctx.audio.pop(); paint() } }, text))))),
  h('p', { class: 'note' }, '流星要在晴朗的夜里才看得见。'))
  paint()
  ctx.ui.openDrawer({ kicker: '换个时候来', title: '森林', sub: '季节和昼夜默认跟着你这边真实的日子和时间走。', body })
}
