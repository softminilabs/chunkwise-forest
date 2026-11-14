// 英音、美音两颗发音按钮，后面跟着「循环读」。背词的纸上、词库的详情里是同一排
import { h } from './core.js'
import { t } from '../i18n.js'
import { soundUrl } from '../words/deck.js'

// 读完隔几秒再读，0 是不循环。和手机 App 一样的三档
const GAPS = [0, 0.5, 1]
let gap = (() => { try { return Number(localStorage.getItem('cw.loop')) || 0 } catch { return 0 } })()

/// 循环开着的时候点发音会一直读，再点一下同一颗就停。例句、卡片出来时自动读的那一遍都不循环
export function prons(voice, word) {
  const pills = {}
  let looping = null
  const light = kind => { looping = kind; for (const key in pills) pills[key].classList.toggle('is-on', key === kind) }

  async function say(kind) {
    const url = soundUrl(kind, word)
    if (!gap) return voice.play(url)
    if (looping === kind) return voice.stop()
    light(kind)
    await voice.loop(url, () => gap)
    // 是被另一颗顶掉的话，那一颗已经亮着了，不能把它也熄掉
    if (looping === kind) light(null)
  }

  for (const [kind, label, name] of [['uk', t('英'), t('英式发音')], ['us', t('美'), t('美式发音')]]) {
    pills[kind] = h('button', { class: 'pron', type: 'button', 'aria-label': name, onclick: () => say(kind) }, h('i', { class: 'speaker' }), h('b', {}, label), word[kind])
  }
  const options = h('div', { class: 'segment small' })
  const pick = value => { gap = value; try { localStorage.setItem('cw.loop', String(value)) } catch {} paint() }
  const paint = () => options.replaceChildren(...GAPS.map(value => h('button', { class: value === gap ? 'is-on' : '', type: 'button', onclick: () => pick(value) }, value ? t('隔 {n} 秒', { n: value }) : t('关'))))
  paint()
  return h('div', { class: 'says' }, pills.uk, pills.us, h('div', { class: 'loop' }, h('span', {}, t('循环读')), options))
}
