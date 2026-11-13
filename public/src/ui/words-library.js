// 词库：单词屋书架上的大页面。顶上五个级别，下面是这一级的话题，再下面是单词卡片，点卡片看详情
import { h } from './core.js'
import { lang, pick, t } from '../i18n.js'
import { findIn, loadIndex, loadLevel, soundUrl } from '../words/deck.js'

// 一个级别一两千个词，一口气全画出来会卡：一次只画这么多张，滚到底再接着画
const BATCH = 60
// 英文界面只出英文：辨析、搭配的中文、例句的中文都是给看得懂中文的人的
const inChinese = lang !== 'en'
const speaker = () => h('i', { class: 'speaker' })
const cut = (text, [from, to]) => [text.slice(0, from), h('mark', {}, text.slice(from, to)), text.slice(to)]
const ruler = document.createElement('canvas').getContext('2d')

/// 这个词照词头的字体排出来有多宽，单位是字高。词头的字号照它缩（见 library.css）；
/// 按字母数估不准：m、w 比 i、l 宽一倍多，同样九个字母，recommend 放不下，political 还有富余
function widthOf(text) {
  ruler.font = `800 100px ${getComputedStyle(document.documentElement).getPropertyValue('--read')}`
  return ruler.measureText(text).width / 100
}

/// 话题的名字 index.json 里只有中文，英文界面拿话题的 id 当名字
const topicName = (view, id) => id === 'all' ? t('全部') : inChinese ? view.index.topics.find(([key]) => key === id)[1] : id[0].toUpperCase() + id.slice(1)

/// 一个发音：喇叭和音标装在一颗按钮里。kind：uk 英音、us 美音；label：详情里音标前的「英」「美」，列表卡片上不写
function pron(view, word, kind, label) {
  // 卡片整张都能点：点发音不能连带把详情打开
  const play = event => { event.stopPropagation(); view.voice.play(soundUrl(kind, word)) }
  return h('button', { class: 'pron', type: 'button', 'aria-label': kind === 'uk' ? t('英式发音') : t('美式发音'), onclick: play }, speaker(), label && h('b', {}, label), word[kind])
}

function card(view, word, k) {
  const first = word.senses[0]
  return h('div', { class: `wcard${view.progress.isLearned(word.id) ? ' is-known' : ''}`, onclick: () => openWord(view, k) },
    h('strong', { lang: 'en' }, word.w), h('span', {}, h('i', {}, first.pos), pick(first)),
    h('div', { class: 'plays' }, pron(view, word, 'uk'), pron(view, word, 'us')))
}

function more(view) {
  const next = view.words.slice(view.drawn, view.drawn + BATCH)
  view.grid.append(...next.map((word, k) => card(view, word, view.drawn + k)))
  view.drawn += next.length
}

function paintTabs(view) {
  const level = view.index.levels.find(item => item.id === view.level)
  const tab = (key, id, name, count) => h('button', { class: view[key] === id ? 'is-on' : '', type: 'button', onclick: () => choose(view, key, id) }, name, h('small', {}, String(count)))
  view.levels.replaceChildren(...view.index.levels.map(item => tab('level', item.id, item.id, item.count)))
  view.topics.replaceChildren(tab('topic', 'all', t('全部'), level.count), ...view.index.topics.filter(([id]) => level.topics[id]).map(([id]) => tab('topic', id, topicName(view, id), level.topics[id])))
}

async function show(view) {
  const { level, topic } = view
  paintTabs(view)
  view.words = []
  view.drawn = 0
  view.grid.replaceChildren()
  view.grid.scrollTop = 0
  const all = await loadLevel(level)
  // 一个级别的文件第一次取要等一会儿。等的时候又点了别的，晚到的这份就不画了
  if (level !== view.level || topic !== view.topic) return
  view.words = topic === 'all' ? all : all.filter(word => word.topic === topic)
  more(view)
}

function choose(view, key, id) {
  if (view[key] === id) return
  view[key] = id
  // 换级别就回到「全部」：上一级选的话题在这一级不一定是想看的
  if (key === 'level') view.topic = 'all'
  show(view)
}

/// 详情盖在列表上面，列表不收起来：收起来再放出来，滚到哪儿了不是每个浏览器都留着
function setPage(view, detail) {
  view.voice.stop()
  view.browse.inert = detail
  view.detail.hidden = !detail
}

/// 第 k 条例句。第二条只有一部分词有录音，没有的喇叭不露出来（位置留着，两条例句的字才对得齐）
function example(view, word, k) {
  const { en, zh } = word.ex[k]
  const canPlay = k === 0 || word.x2
  const hit = findIn(en, word)
  return h('div', { class: 'ex' },
    h('button', { class: `say${canPlay ? '' : ' is-mute'}`, type: 'button', disabled: !canPlay, 'aria-label': t('听这句'), onclick: () => view.voice.play(soundUrl(k ? 'ex2' : 'ex', word)) }, speaker()),
    h('p', { lang: 'en' }, hit ? cut(en, hit) : en, inChinese && h('small', {}, zh)))
}

/// 课文里出现过这个词的那一句。放的是课文的原声：整课的朗读是一个文件，按这句的起止时间掐着放
function lessonLine(view, line) {
  return h('div', { class: 'heard' },
    h('button', { class: 'say', type: 'button', 'aria-label': t('听这句'), onclick: () => view.voice.play(`data/audio/${line.l}.m4a`, line.a, line.b) }, speaker()),
    h('p', { lang: 'en' }, h('span', { class: 'kicker' }, t('第 {n} 课里听过', { n: line.n })), cut(line.en, line.r)))
}

function detail(view, word) {
  const line = view.lessons.get(word.w.toLowerCase())
  const sense = item => h('li', {}, h('i', {}, item.pos), pick(item), inChinese && h('small', { lang: 'en' }, item.en))
  return [
    h('div', {}, h('h1', { lang: 'en', style: `--w:${widthOf(word.w)}` }, word.w),
      h('div', { class: 'says' }, pron(view, word, 'uk', t('英')), pron(view, word, 'us', t('美'))),
      h('ul', { class: 'senses' }, word.senses.map(sense)),
      inChinese && word.tip && h('p', { class: 'tip' }, h('b', {}, t('辨析')), word.tip),
      word.fam.length > 0 && h('p', { class: 'tip' }, h('b', {}, t('同族')), word.fam.join(inChinese ? '、' : ', '))),
    h('div', {}, word.ex.map((_, k) => example(view, word, k)),
      h('div', { class: 'cols' }, word.col.map(([en, zh]) => h('div', {}, h('b', { lang: 'en' }, en), inChinese && h('span', {}, zh)))),
      line && lessonLine(view, line)),
  ]
}

function openWord(view, k) {
  view.at = k
  view.back.textContent = `← ${view.level} · ${topicName(view, view.topic)}`
  view.where.textContent = t('第 {n} 个，共 {total} 个', { n: k + 1, total: view.words.length })
  view.body.replaceChildren(...detail(view, view.words[k]))
  view.body.scrollTop = 0
  setPage(view, true)
}

function step(view, by) {
  const next = view.at + by
  if (next >= 0 && next < view.words.length) openWord(view, next)
}

function listen(view) {
  if (!view.words.length) return
  const refs = view.words.map(word => ({ id: word.id, lv: view.level }))
  // 先关再交出去：关页面会把声音停掉，而接手的那边多半马上就拿同一个 voice 放第一个词
  view.ctx.ui.closeModal()
  view.onListen(refs)
}

function onKey(view, event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const inDetail = !view.detail.hidden
  if (event.code === 'Escape') {
    // 不让它传到 controls.js：那边的 Esc 不管在哪一层都是直接把大卡片关掉
    event.stopPropagation()
    return inDetail ? setPage(view, false) : view.ctx.ui.closeModal()
  }
  if (inDetail && event.code === 'ArrowLeft') step(view, -1)
  if (inDetail && event.code === 'ArrowRight') step(view, 1)
}

function build(view) {
  const { ctx } = view
  const round = (label, text, onclick) => h('button', { class: 'close', type: 'button', 'aria-label': label, onclick }, text)
  const shut = () => round(t('关上'), '✕', () => ctx.ui.closeModal())
  view.count = h('small', {})
  view.levels = h('nav', { class: 'levels' })
  view.topics = h('nav', { class: 'topics' })
  view.grid = h('div', { class: 'grid' })
  view.back = h('button', { class: 'button plain', type: 'button', onclick: () => setPage(view, false) })
  view.where = h('small', { class: 'where' })
  view.body = h('div', { class: 'detail-body' })
  view.browse = h('div', { class: 'browse' },
    h('header', { class: 'lib-head' }, h('h2', {}, t('词库')), view.count, h('span', { class: 'grow' }),
      view.onListen && h('button', { class: 'button plain', type: 'button', onclick: () => listen(view) }, t('▶ 听这一组')), shut()),
    view.levels, view.topics, view.grid)
  view.detail = h('div', { class: 'detail', hidden: true },
    h('header', { class: 'lib-head' }, view.back, h('span', { class: 'grow' }), view.where,
      round(t('上一个'), '‹', () => step(view, -1)), round(t('下一个'), '›', () => step(view, 1)), shut()),
    view.body)
  view.root = h('section', { class: 'library sticker', 'aria-label': t('词库') }, view.browse, view.detail)
  // 宽屏只有网格在滚，窄屏是整页一起滚（见 library.css），两个都要听
  for (const box of [view.browse, view.grid]) box.addEventListener('scroll', () => { if (box.scrollTop + box.clientHeight > box.scrollHeight - 600) more(view) })
}

export function openLibrary(ctx, { onListen } = {}) {
  const { progress, voice } = ctx.words
  const view = { ctx, onListen, progress, voice, index: null, level: progress.store.level, topic: 'all', words: [], drawn: 0, at: 0, lessons: ctx.words.lessons }
  build(view)
  const keys = event => onKey(view, event)
  // 在捕获阶段听：controls.js 的全局按键先注册，不抢在它前面就拦不住 Esc
  addEventListener('keydown', keys, true)
  ctx.ui.openModal(view.root, () => { voice.stop(); removeEventListener('keydown', keys, true) })
  loadIndex().then(index => {
    view.index = index
    view.count.textContent = t('{n} 个词', { n: index.total })
    show(view)
  })
}
