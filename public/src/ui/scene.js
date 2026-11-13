// 「森林」面板：季节、昼夜、天气。季节和昼夜默认跟着真实的日子和时间
import { SEASON_NAMES, WEATHER_NAMES, weathersOf } from '../look.js'
import { h } from './core.js'
import { t } from '../i18n.js'

/// 天气那一行只列这个季节、这个时候会有的：春夏秋是雨，冬天是雪，夜里才有流星
function rows(now, dark) {
  const weathers = weathersOf(now.season, dark).map(id => [id, typeof WEATHER_NAMES[id] === 'string' ? WEATHER_NAMES[id] : WEATHER_NAMES[id][now.season]])
  return [
    ['season', t('季节'), [['auto', t('跟着日子')], ...Object.entries(SEASON_NAMES)]],
    ['time', t('昼夜'), [['auto', t('跟着时间')], ['day', t('白天')], ['night', t('夜晚')]]],
    ['weather', t('天气'), weathers],
  ]
}

export function openScene(ctx) {
  const body = h('div', { class: 'drawer-rows' })
  const paint = () => body.replaceChildren(...rows(ctx.weather.now, ctx.weather.dark).map(([key, label, options]) => h('div', {}, h('p', { class: 'kicker' }, label),
    h('div', { class: 'row' }, options.map(([value, text]) => h('button', { class: `chip${ctx.state.town.scene[key] === value ? ' is-on' : ''}`, type: 'button', onclick: () => { ctx.state.patch({ scene: { ...ctx.state.town.scene, [key]: value } }); ctx.weather.resolve(); ctx.weather.repaint(); ctx.audio.pop(); paint() } }, text))))),
  h('p', { class: 'note' }, ctx.weather.now.weather === 'meteor' ? t('站着别动，镜头会抬起来看天；一走动就回到平时的视角。') : ctx.weather.dark ? t('现在是夜里，可以看流星。') : t('流星只在夜里有：把昼夜换成夜晚就能选。')))
  paint()
  ctx.ui.openDrawer({ kicker: t('换个时候来'), title: t('森林'), sub: t('季节和昼夜默认跟着你这边真实的日子和时间走。'), body })
}
