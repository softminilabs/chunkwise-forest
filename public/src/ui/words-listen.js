// 听单词：一个词一个词自己放下去，适合闭着眼听。每个词先放英文，停一下让人自己先想意思（先想再听答案，
// 比一路被动听记得牢），再报意思、放例句。只听不打分，不动学习进度：被动听过不等于记得。流程照手机 App 的 WordListen
import { h } from './core.js'
import { icon } from './reader-view.js'
import { lang, pick, t } from '../i18n.js'
import { findIn, loadLevel, soundUrl, wordsOf } from '../words/deck.js'

const MINUTE = 60000
const FRESH = 20
// 「在学的」「学过的」最多放这么多个，和手机 App 一样
const LIMIT = 200
// 一打开时，记着的那一样要是空的，就照这个顺序往下找第一样有词的
const ORDER = ['today', 'learning', 'learned', 'fresh']
// 一个词放完到下一个词：短了词和词黏在一起，长了等得人走神
const GAP = 800
// 意思念不出来的时候（没有合适的声音、浏览器不让出声），亮着停这么久再往下
const UNSPOKEN = 1500
const DEFAULTS = { source: 'today', accent: 'uk', think: 2, example: true, until: 0 }
// macOS 把一批机器腔和搞怪的声音也报上来，还排在自然的声音前面，不滤掉念中文的就成了 Eddy（手机 App 的 LessonSpeaker.isNatural 滤的是同一批）
const ROBOTIC = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Fred|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Zarvox)\b/

const SOURCES = {
  refs: { name: t('这一组'), none: t('这一组里没有词'), refs: listen => listen.refs },
  today: { name: t('今天的词'), none: t('今天还没学词'), refs: listen => listen.ctx.words.progress.today() },
  learning: { name: t('在学的'), none: t('还没有在学的词'), refs: listen => learning(listen.ctx.words.progress).slice(0, LIMIT) },
  learned: { name: t('学过的'), none: t('还没有学过的词'), refs: listen => listen.ctx.words.progress.learned().slice(0, LIMIT) },
  // 没学的：在学的那一级里还没学的头一批。什么都没学过的人前三样全是空的，靠它才有东西听
  fresh: { name: t('没学的'), none: t('这一级的词都学过了') },
}
const OPTIONS = [
  { key: 'source', label: t('听哪些'), choices: ORDER.map(id => [id, SOURCES[id].name]) },
  { key: 'accent', label: t('发音'), choices: [['uk', t('英音')], ['us', t('美音')]] },
  { key: 'think', label: t('听完词，停几秒再报意思'), choices: [[0, t('不停')], ...[2, 4].map(n => [n, t('{n} 秒', { n })])] },
  { key: 'example', label: t('例句'), choices: [[true, t('读')], [false, t('不读')]] },
  { key: 'until', label: t('放到什么时候'), choices: [[0, t('放完这组')], ...[15, 30, 60].map(n => [n, t('{n} 分', { n })])] },
]

const read = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cw.listen')) } } catch { return { ...DEFAULTS } } }
const save = opts => { try { localStorage.setItem('cw.listen', JSON.stringify(opts)) } catch {} }
const word = listen => listen.words[listen.at]
const reveal = (listen, level) => { listen.view.root.dataset.show = level }
const wait = (listen, ms) => new Promise(done => { listen.release = done; listen.timer = setTimeout(done, ms) })

/// 在学的：到期的和学会的并在一起，早到期的在前
function learning(progress) {
  const { cards } = progress.store
  const ids = [...new Set([...progress.due(), ...progress.learned()].map(ref => ref.id))]
  return ids.sort((a, b) => cards[a].due - cards[b].due).map(id => ({ id, lv: cards[id].lv }))
}

/// 念出来的意思。中文只念第一个义项的前两个意思：词性念出来是「v 点」，义项全念又太长
function spoken(item) {
  const sense = item.senses[0]
  if (lang === 'en') return sense.en
  return sense.zh.split(/[，,；;]/).map(part => part.trim()).filter(Boolean).slice(0, 2).join('，')
}

/// 念意思用哪个声音。中文只认普通话和国语（zh-HK 是粤语）；英文跟着「发音」那一项走。没有合适的就不念
function pickVoice(accent) {
  // 苹果设备上另装的好声音，名字后面带 (Premium)、(Enhanced)：有好的先用好的，手机 App 也是这个顺序
  const grade = voice => (voice.name.includes('Premium') ? 0 : voice.name.includes('Enhanced') ? 1 : 2)
  const voices = speechSynthesis.getVoices().filter(voice => !ROBOTIC.test(voice.name)).sort((a, b) => grade(a) - grade(b))
  // 安卓上语言写成 zh_CN
  const speaks = code => voices.find(voice => voice.lang.replace('_', '-').toLowerCase().startsWith(code))
  return lang === 'en' ? speaks(accent === 'us' ? 'en-us' : 'en-gb') ?? speaks('en') : speaks('zh-cn') ?? speaks('zh-tw')
}

/// 把意思念出来。念完了给 true；念不了（不支持、没有合适的声音、浏览器不让出声）或者被打断给 false
function speak(listen, text) {
  const voice = window.speechSynthesis && pickVoice(listen.opts.accent)
  if (!voice) return Promise.resolve(false)
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  // 得一直抓着它：Chrome 里这个对象要是被回收了，念完的事件就不来了
  listen.utterance = utterance
  return new Promise(done => {
    // 有的浏览器念着念着就没了下文，两个事件都不来：按字数给个上限，到点当它没念成，不在这儿卡死
    const limit = setTimeout(() => { speechSynthesis.cancel(); finish(false) }, 3000 + text.length * (lang === 'en' ? 100 : 400))
    // 只清自己的计时器：被打断以后「出错」的事件来得晚，那时 listen.timer 已经是下一串的了
    const finish = said => { clearTimeout(limit); done(said) }
    listen.timer = limit
    listen.release = () => finish(false)
    utterance.onend = () => finish(true)
    utterance.onerror = () => finish(false)
    speechSynthesis.speak(utterance)
  })
}

// 一个词的五步：放词、停下来想、报意思、例句、歇一下。alive：这一串还作数吗，一步里要等两回的得在中间问一次
const STEPS = [
  listen => listen.ctx.words.voice.play(soundUrl(listen.opts.accent, word(listen))),
  listen => wait(listen, listen.opts.think * 1000),
  async (listen, alive) => { if (!await speak(listen, spoken(word(listen))) && alive()) await wait(listen, UNSPOKEN) },
  async (listen, alive) => {
    if (!listen.opts.example) return
    await listen.ctx.words.voice.play(soundUrl('ex', word(listen)))
    if (alive()) reveal(listen, 3)
  },
  listen => wait(listen, GAP),
]
// 每一步开始时纸上露到哪：0 只有词和音标，1 加上意思，2 加上例句，3 加上例句的中文
const SHOWN = [0, 0, 1, 2, 3]

/// 打断正在放的这一步，并作废还在路上的那一串
function halt(listen) {
  listen.token += 1
  clearTimeout(listen.timer)
  listen.ctx.words.voice.stop()
  window.speechSynthesis?.cancel()
  listen.release?.()
}

function setPlaying(listen, on) {
  listen.playing = on
  listen.ctx.speaking = on
  listen.view.play.replaceChildren(icon(on ? 'pause' : 'play'))
  listen.view.play.setAttribute('aria-label', on ? t('暂停') : t('播放'))
  // 停下来时全露出来，方便看
  if (!on) reveal(listen, 3)
}

function example(item) {
  const { en, zh } = item.ex[0]
  const hit = findIn(en, item)
  return h('p', { class: 'listen-ex', lang: 'en' }, hit ? [en.slice(0, hit[0]), h('mark', {}, en.slice(...hit)), en.slice(hit[1])] : en, lang === 'zh' && h('small', { lang: 'zh' }, zh))
}

function show(listen) {
  const { view, words, at, opts } = listen
  const item = words[at]
  view.count.textContent = item ? `${at + 1} / ${words.length}` : ''
  if (!item) return view.now.replaceChildren(h('p', { class: 'listen-none' }, SOURCES[listen.source].none))
  view.now.replaceChildren(
    // --n：词有多少个字母，长词按它缩小，不然一行摆不下
    h('h2', { class: 'listen-word', lang: 'en', style: `--n:${item.w.length}` }, item.w),
    h('p', { class: 'listen-ipa' }, h('b', {}, opts.accent === 'uk' ? t('英') : t('美')), item[opts.accent]),
    h('ul', { class: 'listen-senses' }, item.senses.map(sense => h('li', {}, h('i', {}, sense.pos), pick(sense)))),
    opts.example && example(item))
}

function goTo(listen, at) {
  listen.at = at
  listen.step = 0
  show(listen)
}

/// 从 listen.at、listen.step 往下放。任何时候只有一串在跑：新的一串开始前令牌加一，旧的那串醒来发现令牌变了就退出
async function run(listen) {
  halt(listen)
  const token = listen.token
  const alive = () => token === listen.token
  while (alive()) {
    // 定时只在词和词之间看：放完手上这个词再停，不在半个词里掐断
    if (listen.step === 0 && listen.deadline && Date.now() >= listen.deadline) {
      listen.deadline = null
      return setPlaying(listen, false)
    }
    reveal(listen, SHOWN[listen.step])
    await STEPS[listen.step](listen, alive)
    if (!alive()) return
    if (++listen.step < STEPS.length) continue
    const last = listen.at === listen.words.length - 1
    goTo(listen, last ? 0 : listen.at + 1)
    if (last && !listen.opts.until) return setPlaying(listen, false)
  }
}

/// 接着放时，停在哪一步就从那一步重新来
function play(listen) {
  if (!listen.words.length) return
  if (listen.opts.until && !listen.deadline) listen.deadline = Date.now() + listen.opts.until * MINUTE
  setPlaying(listen, true)
  run(listen)
}

function pause(listen) {
  halt(listen)
  setPlaying(listen, false)
}

const toggle = listen => (listen.playing ? pause(listen) : play(listen))

/// 上一个、下一个从那个词的第一步放起；暂停着就只换词不出声
function jump(listen, offset) {
  if (!listen.words.length) return
  goTo(listen, Math.min(Math.max(0, listen.at + offset), listen.words.length - 1))
  if (listen.playing) run(listen)
}

const KEYS = { Space: toggle, ArrowLeft: listen => jump(listen, -1), ArrowRight: listen => jump(listen, 1) }

/// 按「听哪些」取词，从第一个放起。auto：刚打开、不是人选的——这一样是空的就换下一样
async function load(listen, auto = false) {
  halt(listen)
  // 连着换了两回，先问的那回后到，不能把后问的盖掉
  const turn = ++listen.turn
  const { progress } = listen.ctx.words
  const fresh = listen.source === 'fresh'
  const words = fresh ? progress.newWords(await loadLevel(progress.store.level), FRESH) : await wordsOf(SOURCES[listen.source].refs(listen))
  if (turn !== listen.turn) return
  const next = ORDER[ORDER.indexOf(listen.source) + 1]
  // 别让人一打开就对着一句「今天还没学词」
  if (!words.length && auto && next && listen.source !== 'refs') { listen.source = next; return load(listen, true) }
  for (const button of listen.view.root.querySelectorAll('[data-pick^="source:"]')) button.classList.toggle('is-on', button.dataset.pick === `source:${listen.source}`)
  listen.words = words
  const name = fresh ? t('{level} 里还没学的前 {n} 个', { level: progress.store.level, n: words.length }) : SOURCES[listen.source].name
  listen.view.kicker.textContent = `${t('听单词')} · ${name}`
  for (const button of listen.view.keys.children) button.disabled = !words.length
  goTo(listen, 0)
  if (words.length) play(listen)
  else setPlaying(listen, false)
}

function choose(listen, key, value) {
  if (key === 'source') listen.source = value
  // 「这一组」是这回临时带进来的，不记：下次没带词来就没有这一项
  if (value !== 'refs') {
    listen.opts[key] = value
    save(listen.opts)
  }
  if (key === 'source') return load(listen)
  // 定时从选的那一刻算起
  if (key === 'until') listen.deadline = value ? Date.now() + value * MINUTE : null
  // 音标跟着发音换；例句读不读，纸上也跟着有没有
  else if (key !== 'think' && listen.words.length) show(listen)
}

function optionRow(listen, { key, label, choices }) {
  const current = key === 'source' ? listen.source : listen.opts[key]
  const segment = h('div', { class: 'segment small' }, choices.map(([value, name]) => h('button', { class: value === current ? 'is-on' : '', type: 'button', 'data-pick': `${key}:${value}`, onclick: event => {
    for (const button of segment.children) button.classList.toggle('is-on', button === event.currentTarget)
    choose(listen, key, value)
  } }, name)))
  return h('div', { class: 'listen-opt' }, h('span', {}, label), segment)
}

function build(listen) {
  const round = (label, hint, name, act) => h('button', { type: 'button', 'aria-label': label, title: hint, onclick: act }, icon(name))
  const view = {
    kicker: h('p', { class: 'kicker' }),
    count: h('span', { class: 'listen-count' }),
    now: h('div', { class: 'listen-now' }),
    play: h('button', { class: 'listen-main', type: 'button', 'aria-label': t('播放'), title: t('播放 / 暂停（空格）'), onclick: () => toggle(listen) }, icon('play')),
  }
  view.keys = h('div', { class: 'listen-keys' }, round(t('上一个'), t('上一个（←）'), 'prev', () => jump(listen, -1)), view.play, round(t('下一个'), t('下一个（→）'), 'next', () => jump(listen, 1)))
  const options = listen.refs ? [{ ...OPTIONS[0], choices: [['refs', SOURCES.refs.name], ...OPTIONS[0].choices] }, ...OPTIONS.slice(1)] : OPTIONS
  view.root = h('section', { class: 'listen', 'aria-label': t('听单词'), 'data-show': 3 },
    h('header', { class: 'listen-head' }, view.kicker, view.count),
    view.now,
    h('div', { class: 'listen-opts' }, options.map(option => optionRow(listen, option)), view.keys))
  return view
}

/// refs：指定放哪一组词 [{ id, lv }]（词库页点「听这一组」传进来的）；不传就按设置里的「听哪些」
export function createListen(ctx, { refs = null } = {}) {
  const opts = read()
  const source = refs ? 'refs' : opts.source
  const listen = { ctx, refs, opts, source, words: [], at: 0, step: 0, playing: false, token: 0, turn: 0, timer: 0, release: null, utterance: null, deadline: null, view: null }
  listen.view = build(listen)
  // 声音的清单头一回问多半是空的，浏览器这才去取：先问一声，等到要念的时候就有了
  window.speechSynthesis?.getVoices()
  const onKey = event => {
    const action = KEYS[event.code]
    if (!action || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    action(listen)
  }
  return {
    node: listen.view.root,
    start() {
      addEventListener('keydown', onKey)
      load(listen, true)
    },
    stop() {
      listen.turn += 1
      pause(listen)
      removeEventListener('keydown', onKey)
    },
  }
}
