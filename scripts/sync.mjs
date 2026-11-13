// 把运行要用的东西备齐：three.js 从 node_modules 拷到 public/vendor，课文、朗读、组块从旁边的 chunkwise-web 整理到 public/data。
// 课文内容只有一份源头（App 仓库 → chunkwise-web/content），这里不改内容，只换成小镇里好用的形状
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WEB = resolve('../chunkwise-web')
const OUT = resolve('public/data')
const VENDOR = resolve('public/vendor')
const B1_UNITS = 9
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'))

function copyVendor() {
  rmSync(VENDOR, { recursive: true, force: true })
  mkdirSync(join(VENDOR, 'addons/geometries'), { recursive: true })
  for (const name of ['three.module.js', 'three.core.js']) cpSync(`node_modules/three/build/${name}`, join(VENDOR, name))
  cpSync('node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js', join(VENDOR, 'addons/geometries/RoundedBoxGeometry.js'))
  cpSync('node_modules/qrcode-generator/dist/qrcode.mjs', join(VENDOR, 'qrcode.mjs'))
}

const tokens = text => [...text.matchAll(/[A-Za-z']+/g)].map(match => ({ word: match[0].toLowerCase(), from: match.index, to: match.index + match[0].length }))
// 组块写法里的占位词：到了句子里是别的词（sb → me、doing → checking），be 会变形或缩写（He's）
const PLACEHOLDERS = new Set(['sb', 'sth', "sb's", 'doing', 'do', 'be'])

/// 手稿的填空答案在这一句里的位置；一句里出现两次时取和原来划的那段重叠最多的那一处
function locate(text, answer, r) {
  const needle = answer.replace(/[.,!?]+$/, '').toLowerCase()
  const lower = text.toLowerCase()
  let best = null
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + 1)) {
    const overlap = Math.min(at + needle.length, r[1]) - Math.max(at, r[0])
    if (!best || overlap > best.overlap) best = { at, overlap }
  }
  return best && [best.at, best.at + needle.length]
}

/// 组块在这一句里到底占哪几个字符。网页版算出来的范围 r 常常是手稿里「原话」那一整段（he promised to call me back），
/// 课文里的下划线和练习里的空都跟着宽了半句。这里收窄到组块自己的词：
/// 手稿的填空答案盖得住整个组块（call me back）就用它；答案只是组块的一截（pick up 的答案是 up），
/// 就在原来那段里找从组块第一个词到最后一个词（picked it up）；隔得太远（left … with a note）还是用答案
function tighten(text, r, chunk, forms, answer) {
  const content = tokens(chunk.replaceAll('/', ' ')).map(item => item.word).filter(word => !PLACEHOLDERS.has(word))
  const answerAt = answer ? locate(text, answer, r) : null
  if (answerAt && tokens(text.slice(...answerAt)).length >= content.length) return answerAt
  const shapes = Object.values(forms ?? {}).filter(form => typeof form === 'string').map(tokens)
  const first = new Set([content[0], ...shapes.map(shape => shape[0]?.word)])
  const last = new Set([content.at(-1), ...shapes.map(shape => shape.at(-1)?.word)])
  const words = tokens(text.slice(r[0], r[1]))
  const i = words.findIndex(item => first.has(item.word))
  const j = words.findLastIndex(item => last.has(item.word))
  if (i >= 0 && j >= i && j - i + 1 <= tokens(chunk).length + 3) return [r[0] + words[i].from, r[0] + words[j].to]
  return answerAt ?? r
}

/// 一课里用到的组块：位置取这一课里第一次出现的那句。formsOf：每个组块的变形（讲它的那一课手稿里写的）
function chunksOf(lesson, allChunks, sentences, formsOf) {
  const found = []
  for (const chunk of allChunks) {
    const use = chunk.uses.find(item => item.l === lesson.id)
    if (!use) continue
    // 这一课重点讲的组块，课文里另有中文的用法提示和例句，练习里有手写的填空
    const taught = lesson.expressions.find(item => item.chunk === chunk.chunk)
    const answer = taught && lesson.practice.cloze.find(item => item.en === taught.inText)?.answer
    const r = tighten(sentences[use.s].en, use.r, chunk.chunk, formsOf.get(chunk.chunk), answer)
    found.push({ id: chunk.id, kind: 'chunk', text: chunk.chunk, zh: chunk.zh, note: chunk.def, tip: taught?.note ?? '', example: taught?.example ?? '', s: use.s, r })
  }
  return found
}

/// 一课的生词：讲解里列的那几个，按它在课文里的原话找到是哪一句、哪几个字符
function wordsOf(lesson, sentences) {
  const found = []
  for (const item of lesson.guide?.vocab ?? []) {
    const needle = item.inText.toLowerCase()
    const s = sentences.findIndex(sentence => sentence.en.toLowerCase().includes(needle))
    if (s < 0) continue
    const text = sentences[s].en
    const from = text.toLowerCase().indexOf(needle)
    // 原话是一小段（a soft hum），只标里面那个词本身，带上它的词尾（bumping、shifts）；变形认不出来（left）就标整段
    const inner = needle.indexOf(item.word.toLowerCase())
    const start = from + Math.max(0, inner)
    let end = inner < 0 ? from + needle.length : start + item.word.length
    if (inner >= 0) while (/[a-z]/i.test(text[end] ?? '')) end += 1
    // 所有格的 's 也算这个词的（newsagent's）：朗读的时间轴里它是一个词，不带上的话这张卡在课文里点不到
    if (text.slice(end, end + 2).toLowerCase() === "'s") end += 2
    found.push({ id: `w-${item.word.toLowerCase().replace(/[^a-z]+/g, '-')}`, kind: 'word', text: item.word, pos: item.pos, zh: item.zh, note: item.note ?? '', s, r: [start, end] })
  }
  return found
}

/// seen：整套课里已经出过场的卡片。第一次出场的那一课记成 fresh，并把这张卡写进总表（练习场用）
/// 固定种子的随机数：每次同步出来的结果一样
function seeded(seed) {
  let state = seed
  return () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const shuffled = (list, random) => list.map(item => [random(), item]).sort((a, b) => a[0] - b[0]).map(pair => pair[1])

/// 预测题的选项重新排位，只换顺序、不改字。手稿里正确答案很少放第一个（90 题里只有 9 题），做多了能猜出来；
/// slot 是这一题的正确答案该放第几个，整套课里四个位置排得一样多
function placeAnswer(pre, slot, random) {
  if (!pre) return null
  const options = shuffled(pre.options.filter((_, k) => k !== pre.answer), random)
  options.splice(slot, 0, pre.options[pre.answer])
  return { ...pre, options, answer: slot }
}

function buildLesson(lesson, allChunks, seen, formsOf, slot, random) {
  const timing = readJSON(join(WEB, `content/audio/${lesson.id}.json`))
  const sentences = lesson.paragraphs.flatMap((paragraph, p) =>
    paragraph.en.map((en, k) => ({ en, zh: paragraph.zh[k], p, ...(paragraph.speaker && k === 0 ? { speaker: paragraph.speaker } : {}) })))
  if (sentences.length !== timing.sentences.length) throw new Error(`${lesson.id}：句子 ${sentences.length} 句，时间轴 ${timing.sentences.length} 句，对不上`)
  const cards = [...chunksOf(lesson, allChunks, sentences, formsOf), ...wordsOf(lesson, sentences)].sort((a, b) => a.s - b.s || a.r[0] - b.r[0])
  for (const card of cards) {
    card.fresh = !seen.has(card.id)
    // 这张卡在这一课里是哪一句、划的是哪几个字、朗读里从几秒到几秒
    const here = { s: card.s, r: card.r, l: lesson.id, n: lesson.number, en: sentences[card.s].en, szh: sentences[card.s].zh, a: timing.sentences[card.s].start, b: timing.sentences[card.s].end }
    // 后面的课里又出现了：记成这张卡的「另一句」。练习场答对以后换一句考，考的就是这些
    if (!card.fresh) { seen.get(card.id).more.push(here); continue }
    const { fresh, ...rest } = card
    seen.set(card.id, { ...rest, ...here, more: [] })
  }
  return {
    id: lesson.id, n: lesson.number, unit: lesson.unit.number, title: lesson.title, genre: lesson.genre, words: lesson.words,
    seconds: Math.round(timing.duration), duration: timing.duration, pre: placeAnswer(lesson.preQuestion, slot, random), intro: lesson.guide?.intro ?? '', sentences,
    timing: timing.sentences.map(item => ({ a: item.start, b: item.end, w: item.words })),
    cards,
  }
}

function main() {
  if (!existsSync(join(WEB, 'dist/assets/data/chunks.json'))) throw new Error('先到 ../chunkwise-web 跑一次 npm run build：组块数据是它生成的')
  copyVendor()
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, 'lessons'), { recursive: true })
  mkdirSync(join(OUT, 'audio'), { recursive: true })
  const allChunks = readJSON(join(WEB, 'dist/assets/data/chunks.json'))
  const outline = readJSON(join(WEB, 'content/course/course-outline.json'))
  const units = outline.units.filter(unit => unit.number <= B1_UNITS).map(unit => ({ n: unit.number, zh: unit.title, en: '', summary: unit.summary ?? '', lessons: [] }))
  const seen = new Map()
  const files = readdirSync(join(WEB, 'content/lessons')).filter(name => name.endsWith('.json')).sort()
  const sources = files.map(name => readJSON(join(WEB, 'content/lessons', name)))
  const formsOf = new Map(sources.flatMap(source => source.expressions.map(item => [item.chunk, item.forms])))
  const random = seeded(20261113)
  // 每一题的正确答案放第几个：0123 轮着排够数，再打乱，四个位置就一样多
  const slots = shuffled(sources.map((_, k) => k % 4), random)
  for (const [k, name] of files.entries()) {
    const source = sources[k]
    const unit = units.find(item => item.n === source.unit.number)
    if (!unit) continue
    const lesson = buildLesson(source, allChunks, seen, formsOf, slots[k], random)
    unit.en = source.unit.en
    unit.lessons.push({ id: lesson.id, n: lesson.n, title: lesson.title, genre: lesson.genre, words: lesson.words, seconds: lesson.seconds, cards: lesson.cards.map(card => card.id) })
    writeFileSync(join(OUT, 'lessons', name), JSON.stringify(lesson))
    cpSync(join(WEB, `content/audio/${lesson.id}.m4a`), join(OUT, 'audio', `${lesson.id}.m4a`))
  }
  writeFileSync(join(OUT, 'course.json'), JSON.stringify({ units, cardTotal: seen.size }))
  writeFileSync(join(OUT, 'cards.json'), JSON.stringify(Object.fromEntries(seen)))
  const words = [...seen.values()].filter(card => card.kind === 'word').length
  console.log(`同步完成：${units.length} 个单元、${units.reduce((sum, unit) => sum + unit.lessons.length, 0)} 课、卡片 ${seen.size} 张（组块 ${seen.size - words}、生词 ${words}）`)
}

main()
