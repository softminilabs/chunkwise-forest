// 「森林」面板：季节、昼夜、天气。季节和昼夜默认跟着真实的日子和时间
import { SEASON_NAMES, WEATHER_NAMES, weathersOf } from '../look.js'
import { h } from './core.js'

/// 天气那一行只列这个季节、这个时候会有的：春夏秋是雨，冬天是雪，夜里才有流星
function rows(now, dark) {
  const weathers = weathersOf(now.season, dark).map(id => [id, typeof WEATHER_NAMES[id] === 'string' ? WEATHER_NAMES[id] : WEATHER_NAMES[id][now.season]])
  return [
    ['season', '季节', [['auto', '跟着日子'], ...Object.entries(SEASON_NAMES)]],
    ['time', '昼夜', [['auto', '跟着时间'], ['day', '白天'], ['night', '夜晚']]],
    ['weather', '天气', weathers],
  ]
}

export function openScene(ctx) {
  const body = h('div', { class: 'drawer-rows' })
  const paint = () => body.replaceChildren(...rows(ctx.weather.now, ctx.weather.dark).map(([key, label, options]) => h('div', {}, h('p', { class: 'kicker' }, label),
    h('div', { class: 'row' }, options.map(([value, text]) => h('button', { class: `chip${ctx.state.town.scene[key] === value ? ' is-on' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ scene: { ...ctx.state.town.scene, [key]: value } }); ctx.weather.resolve(); ctx.weather.repaint(); ctx.audio.pop(); paint() } }, text))))),
  h('p', { class: 'note' }, ctx.weather.now.weather === 'meteor' ? '站着别动，镜头会抬起来看天；一走动就回到平时的视角。' : ctx.weather.dark ? '现在是夜里，可以看流星。' : '流星只在夜里有：把昼夜换成夜晚就能选。'))
  paint()
  ctx.ui.openDrawer({ kicker: '换个时候来', title: '森林', sub: '季节和昼夜默认跟着你这边真实的日子和时间走。', body })
}
