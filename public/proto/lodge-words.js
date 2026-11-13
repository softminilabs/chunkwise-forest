// 词库大页面（样张阶段先放在这儿）：读 public/words/ 里真的词（npm run words 生成），
// 五个级别、十九个话题都能点，发音能听，点卡片看详情。还没接学习进度，所以现在没有哪个词是「学过」的
import { h } from '../src/ui/core.js'

// 一次只画这么多张卡片，滚到底再接着画：一个级别一两千个词，一口气全画出来会卡
const BATCH = 60
const params = new URLSearchParams(location.search)
const page = document.querySelector('.library')
const grid = page.querySelector('.grid')
const voice = new Audio()
const state = { index: null, level: 'B1', topic: 'all', words: [], drawn: 0, at: 0, files: new Map(), lessons: new Map() }
const json = async url => (await fetch(url)).json()
const speaker = () => h('i', { class: 'speaker' })
const sound = (kind, word) => `../words/audio/${kind}/${word.id}.mp3`
const setPage = name => { document.body.dataset.page = name }

/// 放一段录音。from、to：只放其中一段（课文录音里的那一句）
function play(url, from = 0, to = Infinity) {
  voice.pause()
  voice.src = url
  voice.currentTime = from
  voice.ontimeupdate = () => { if (voice.currentTime >= to) voice.pause() }
  voice.play().catch(() => {})
}

/// 一个发音：喇叭和音标装在一颗按钮里。kind：uk 英音、us 美音；label：详情页里音标前的「英」「美」
function pron(word, kind, label) {
  return h('button', { class: 'pron', type: 'button', onclick: event => { event.stopPropagation(); play(sound(kind, word)) } }, speaker(), label && h('b', {}, label), word[kind])
}

function card(word, k) {
  const first = word.senses[0]
  // ?known=6：把前几张标成「学过」，只为看样子
  return h('div', { class: `wcard${k < Number(params.get('known') ?? 0) ? ' is-known' : ''}`, onclick: () => openWord(k) },
    h('strong', { lang: 'en' }, word.w), h('span', {}, h('i', {}, first.pos), first.zh), h('div', { class: 'plays' }, pron(word, 'uk'), pron(word, 'us')))
}

function more() {
  const next = state.words.slice(state.drawn, state.drawn + BATCH)
  grid.append(...next.map((word, k) => card(word, state.drawn + k)))
  state.drawn += next.length
}

/// 顶上的级别、下面这一级有的话题，各带词数
function paintTabs() {
  const level = state.index.levels.find(item => item.id === state.level)
  // 换级别就回到「全部」：上一级选的话题在这一级不一定是想看的
  const pick = (key, value) => () => { state[key] = value; if (key === 'level') state.topic = 'all'; show() }
  const tab = (key, id, name, count) => h('button', { class: state[key] === id ? 'is-on' : '', type: 'button', onclick: pick(key, id) }, name, h('small', {}, String(count)))
  page.querySelector('.levels').replaceChildren(...state.index.levels.map(item => tab('level', item.id, item.id, item.count)))
  page.querySelector('.topics').replaceChildren(tab('topic', 'all', '全部', level.count), ...state.index.topics.filter(([id]) => level.topics[id]).map(([id, name]) => tab('topic', id, name, level.topics[id])))
}

async function show() {
  const all = state.files.get(state.level) ?? await json(`../words/${state.level.toLowerCase()}.json`)
  state.files.set(state.level, all)
  state.words = state.topic === 'all' ? all : all.filter(word => word.topic === state.topic)
  state.drawn = 0
  grid.replaceChildren()
  grid.scrollTop = 0
  more()
  paintTabs()
}

/// 例句里把这个词描出来。词会变形（delivery → deliveries），所以长一点的词去掉最后一个字母再找
function marked(sentence, word) {
  const stem = (word.w.length > 4 ? word.w.slice(0, -1) : word.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`\\b${stem}\\w*`, 'i').exec(sentence)
  return hit ? [sentence.slice(0, hit.index), h('mark', {}, hit[0]), sentence.slice(hit.index + hit[0].length)] : [sentence]
}

/// 第 k 条例句。第二条例句只有一部分词有录音，没有的就不放喇叭
function example(word, k) {
  const canPlay = k === 0 || word.x2
  return h('div', { class: 'ex' }, h('button', { class: `say${canPlay ? '' : ' is-mute'}`, type: 'button', onclick: () => canPlay && play(sound(k ? 'ex2' : 'ex', word)) }, speaker()),
    h('p', { lang: 'en' }, marked(word.ex[k].en, word), h('small', {}, word.ex[k].zh)))
}

/// 课文里出现过这个词的那一句，放的是课文的原声
function lessonLine(line) {
  return h('div', { class: 'heard' }, h('button', { class: 'say', type: 'button', onclick: () => play(`../data/audio/${line.l}.m4a`, line.a, line.b) }, speaker()),
    h('p', { lang: 'en' }, h('span', { class: 'kicker' }, `第 ${line.n} 课里听过`), line.en.slice(0, line.r[0]), h('mark', {}, line.en.slice(line.r[0], line.r[1])), line.en.slice(line.r[1])))
}

function openWord(k) {
  state.at = k
  const word = state.words[k]
  const line = state.lessons.get(word.w.toLowerCase())
  const topic = state.topic === 'all' ? '全部' : state.index.topics.find(([id]) => id === state.topic)[1]
  page.querySelector('.back').textContent = `← ${state.level} · ${topic}`
  page.querySelector('.where').textContent = `第 ${k + 1} 个，共 ${state.words.length} 个`
  page.querySelector('.detail-body').replaceChildren(
    h('div', {}, h('h1', { lang: 'en' }, word.w), h('div', { class: 'says' }, pron(word, 'uk', '英'), pron(word, 'us', '美')),
      h('ul', { class: 'senses' }, word.senses.map(sense => h('li', {}, h('i', {}, sense.pos), sense.zh, h('small', { lang: 'en' }, sense.en)))),
      word.tip && h('p', { class: 'tip' }, h('b', {}, '辨析'), word.tip), word.fam.length > 0 && h('p', { class: 'tip' }, h('b', {}, '同族'), word.fam.join('、'))),
    h('div', {}, word.ex.map((_, n) => example(word, n)), h('div', { class: 'cols' }, word.col.map(([en, zh]) => h('div', {}, h('b', { lang: 'en' }, en), h('span', {}, zh)))), line && lessonLine(line)))
  page.querySelector('.detail-body').scrollTop = 0
  setPage('detail')
}

const step = by => { const next = state.at + by; if (next >= 0 && next < state.words.length) openWord(next) }

function wire() {
  grid.addEventListener('scroll', () => { if (grid.scrollTop + grid.clientHeight > grid.scrollHeight - 600) more() })
  for (const button of page.querySelectorAll('.shut')) button.addEventListener('click', () => { voice.pause(); setPage('') })
  page.querySelector('.back').addEventListener('click', () => setPage('library'))
  page.querySelector('.prev').addEventListener('click', () => step(-1))
  page.querySelector('.next').addEventListener('click', () => step(1))
  addEventListener('keydown', event => {
    const open = document.body.dataset.page
    if (open === 'detail' && event.key === 'ArrowLeft') step(-1)
    if (open === 'detail' && event.key === 'ArrowRight') step(1)
    // Esc：详情回列表，列表回屋里
    if (open && event.key === 'Escape') { voice.pause(); setPage(open === 'detail' ? 'library' : '') }
  })
}

export async function startLibrary() {
  const [index, cards] = await Promise.all([json('../words/index.json'), json('../data/cards.json')])
  state.index = index
  // 课文里收过的词卡：词库里同一个词的详情要带上那句课文
  for (const item of Object.values(cards)) if (item.kind === 'word') state.lessons.set(item.text.toLowerCase(), item)
  page.querySelector('.count').textContent = `${index.total} 个词`
  wire()
  await show()
  // ?word=queue：直接打开这个词的详情（截图用）
  const wanted = state.words.findIndex(word => word.id === params.get('word'))
  if (wanted >= 0) openWord(wanted)
}
