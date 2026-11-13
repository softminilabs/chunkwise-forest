// 书桌：今天的词。先是一张「今天」——复习几个、新词几个，各自能开始，底下两样设置直接摆着；
// 开始之后一张一张过词：正面是词、两个发音、例句，翻面是意思，然后答「忘了」或「记得」。
// 排程在 words/srs.js，这里只管一轮里谁先谁后
import { h } from './core.js'
import { lang, t } from '../i18n.js'
import { findIn, loadIndex, loadLevel, soundUrl, wordsOf } from '../words/deck.js'
import { DAILY, LEVELS } from '../words/progress.js'

const speaker = () => h('i', { class: 'speaker' })
const say = play => h('button', { class: 'say', type: 'button', onclick: play }, speaker())
const segment = (options, current, pick) => h('div', { class: 'segment' }, options.map(option => h('button', { class: option === current ? 'is-on' : '', type: 'button', onclick: () => pick(option) }, String(option))))
/// 句子里把 range 那一段描出来
const marked = (sentence, range) => range ? [sentence.slice(0, range[0]), h('mark', {}, sentence.slice(range[0], range[1])), sentence.slice(range[1])] : [sentence]

export function openDesk(ctx, seat, { stand }) {
  const track = h('i', {})
  const count = h('span', { class: 'seat-count' })
  const bar = h('header', { class: 'seat-bar' }, h('button', { class: 'pill', type: 'button', onclick: () => stand() }, t('← 回屋里')), h('div', { class: 'seat-track' }, track), count)
  const paper = h('div', { class: 'paper-in' })
  const answers = h('footer', { class: 'answers' })
  seat.replaceChildren(bar, h('article', { class: 'paper' }, paper), answers)
  // keys：这一刻按键管什么（今天页是「开始」，词的正面是「看意思」，背面是「忘了 / 记得」）
  const desk = { ctx, progress: ctx.words.progress, voice: ctx.words.voice, stand, bar, track, count, paper, answers, keys: null, topics: new Map(), session: null }
  const onKey = event => { if (!event.metaKey && !event.ctrlKey && !event.altKey) desk.keys?.(event) }
  addEventListener('keydown', onKey)
  showToday(desk)
  return () => { removeEventListener('keydown', onKey); desk.voice.stop() }
}

async function showToday(desk) {
  const { progress } = desk
  const level = progress.store.level
  const [index, words] = await Promise.all([loadIndex(), loadLevel(level)])
  desk.topics = new Map(index.topics)
  const refs = list => list.map(word => ({ id: word.id, lv: level }))
  const due = progress.due()
  const fresh = progress.newWords(words, Math.max(0, progress.store.daily - progress.newToday()))
  // 今天的份学完了还想学：再给一份
  const extra = fresh.length ? [] : progress.newWords(words, progress.store.daily)
  const rows = [
    { name: t('复习'), text: due.length ? t('{n} 个到期', { n: due.length }) : t('今天没有到期的'), label: t('开始'), go: due.length ? () => start(desk, due) : null },
    fresh.length ? { name: t('新词'), text: t('今天 {n} 个 · {level}', { n: fresh.length, level }), label: t('开始'), go: () => start(desk, refs(fresh)) }
      : extra.length ? { name: t('新词'), text: t('今天的 {n} 个学完了', { n: progress.store.daily }), label: t('再学 {n} 个', { n: extra.length }), go: () => start(desk, refs(extra)) }
        : { name: t('新词'), text: t('{level} 的词都学过了', { level }), go: null },
  ]
  // 空格开的是第一件能做的事：有到期的先复习，再学新词
  const next = rows.find(row => row.go)
  const set = values => { progress.set(values); showToday(desk) }
  desk.bar.classList.add('is-plain')
  desk.answers.replaceChildren()
  desk.paper.replaceChildren(
    h('p', { class: 'kicker' }, new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })),
    h('h2', { class: 'zh' }, t('今天的词')),
    ...rows.map(row => h('button', { class: `plan${row === next ? ' is-next' : ''}`, type: 'button', disabled: !row.go, onclick: row.go },
      h('b', {}, row.name), h('span', {}, row.text), row.go && h('i', {}, row.label, row === next && h('kbd', {}, t('空格'))))),
    h('div', { class: 'opts' },
      h('div', { class: 'opt' }, h('span', {}, t('新词学哪一级')), segment(LEVELS, level, value => set({ level: value }))),
      h('div', { class: 'opt' }, h('span', {}, t('每天几个新词')), segment(DAILY, progress.store.daily, value => set({ daily: value })))),
    h('p', { class: 'credit' }, t('词库改编自 '), h('a', { href: 'https://github.com/designfuchen/word-atlas', target: '_blank', rel: 'noopener' }, 'Word Atlas'), ' · CC BY 4.0'))
  desk.keys = event => { if ((event.code === 'Space' || event.code === 'Enter') && next) { event.preventDefault(); next.go() } }
}

/// refs：这一轮要过的词 [{ id, lv }]，可能分在几个级别里（复习的）
async function start(desk, refs) {
  desk.keys = null
  const levels = new Map(refs.map(ref => [ref.id, ref.lv]))
  // once：这一轮里答过至少一次的；firstRight：其中第一次就答「记得」的
  desk.session = { queue: (await wordsOf(refs)).map(word => ({ word, lv: levels.get(word.id) })), finished: new Set(), once: new Set(), firstRight: 0 }
  desk.bar.classList.remove('is-plain')
  showCard(desk)
}

/// 一个发音：喇叭和音标装在一颗按钮里。kind：uk 英音、us 美音
const pron = (desk, word, kind, label) => h('button', { class: 'pron', type: 'button', onclick: () => desk.voice.play(soundUrl(kind, word)) }, speaker(), h('b', {}, label), word[kind])
const topicName = (desk, id) => lang === 'zh' ? desk.topics.get(id) ?? id : id[0].toUpperCase() + id.slice(1)

/// 翻面才露出来的那一块：左边释义和辨析，右边搭配和课文里的那一句。英文界面下只有中文的东西不出
function backOf(desk, word) {
  const zh = lang === 'zh'
  const line = desk.ctx.words.lessons.get(word.w.toLowerCase())
  return [
    h('div', {}, h('ul', { class: 'senses' }, word.senses.map(sense => h('li', {}, h('i', {}, sense.pos), zh ? sense.zh : sense.en))), zh && h('p', { class: 'tip' }, h('b', {}, t('辨析')), word.tip)),
    h('div', {}, h('div', { class: 'cols' }, word.col.map(([en, meaning]) => h('div', {}, h('b', { lang: 'en' }, en), zh && h('span', {}, meaning)))),
      line && h('div', { class: 'heard' }, say(() => desk.voice.play(`data/audio/${line.l}.m4a`, line.a, line.b)),
        h('p', { lang: 'en' }, h('span', { class: 'kicker' }, t('第 {n} 课里听过', { n: line.n })), marked(line.en, line.r)))),
  ]
}

function showCard(desk) {
  const { session, progress } = desk
  const entry = session.queue[0]
  if (!entry) return desk.stand({ count: session.finished.size, firstTry: Math.round(session.firstRight / Math.max(1, session.once.size) * 100) })
  const { word, lv } = entry
  const phase = progress.card(word.id).phase
  const left = new Set(session.queue.map(item => item.word.id)).size
  desk.track.style.width = `${session.finished.size / (session.finished.size + left) * 100}%`
  desk.count.textContent = `${session.finished.size} / ${session.finished.size + left}`
  const meaning = h('small', { hidden: true }, word.ex[0].zh)
  const more = h('div', { class: 'paper-more', hidden: true }, backOf(desk, word))
  desk.paper.replaceChildren(
    h('p', { class: 'kicker' }, [phase === 'new' || phase === 'learning' ? t('新词') : t('复习'), lv, topicName(desk, word.topic)].join(' · ')),
    h('h2', { lang: 'en', class: word.w.length > 11 ? 'is-long' : '' }, word.w),
    h('div', { class: 'says' }, pron(desk, word, 'uk', t('英')), pron(desk, word, 'us', t('美'))),
    h('div', { class: 'ex' }, say(() => desk.voice.play(soundUrl('ex', word))), h('p', { lang: 'en' }, marked(word.ex[0].en, findIn(word.ex[0].en, word)), lang === 'zh' && meaning)),
    more)
  desk.paper.scrollTop = 0
  // 正面是一张短纸条。翻面时上面的字不动，意思在下面展开
  const flip = () => { meaning.hidden = false; more.hidden = false; showAnswers(desk, entry, phase === 'new') }
  desk.answers.replaceChildren(h('button', { class: 'button', type: 'button', onclick: flip }, t('看意思'), h('kbd', {}, t('空格'))))
  desk.keys = event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); flip() } }
  desk.voice.play(soundUrl('uk', word))
}

/// canKnow：第一次见的新词才有「早就会了」
function showAnswers(desk, entry, canKnow) {
  const grade = remembered => () => answer(desk, entry, remembered)
  desk.answers.replaceChildren(
    h('button', { class: 'button soft', type: 'button', onclick: grade(false) }, h('kbd', {}, '←'), t('忘了')),
    h('button', { class: 'button', type: 'button', onclick: grade(true) }, t('记得'), h('kbd', {}, '→')),
    ...(canKnow ? [h('button', { class: 'button plain known', type: 'button', onclick: () => answer(desk, entry, true, true) }, t('早就会了'))] : []))
  desk.keys = event => {
    if (event.code === 'ArrowLeft') { event.preventDefault(); grade(false)() }
    if (event.code === 'ArrowRight') { event.preventDefault(); grade(true)() }
  }
}

/// known：「早就会了」，直接算学会，一个月后抽查
function answer(desk, entry, remembered, known = false) {
  const { session, progress } = desk
  const id = entry.word.id
  if (!session.once.has(id)) { session.once.add(id); if (remembered) session.firstRight += 1 }
  const next = known ? progress.know(id, entry.lv) : progress.answer(id, entry.lv, remembered)
  session.queue.shift()
  // 还在学的词这一轮要再出现：刚忘的隔三张就回来，记得一次的排到最后（和手机 App 一个排法）
  if (next.phase === 'learning' || next.phase === 'relearning') session.queue.splice(next.phase === 'learning' && next.step === 0 ? Math.min(3, session.queue.length) : session.queue.length, 0, entry)
  else session.finished.add(id)
  showCard(desk)
}
