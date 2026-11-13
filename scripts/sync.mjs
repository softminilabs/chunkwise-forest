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

/// 一课里用到的组块：位置取这一课里第一次出现的那句
function chunksOf(lesson, allChunks) {
  const found = []
  for (const chunk of allChunks) {
    const use = chunk.uses.find(item => item.l === lesson.id)
    if (use) found.push({ id: chunk.id, kind: 'chunk', text: chunk.chunk, zh: chunk.zh, note: chunk.def, s: use.s, r: use.r })
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
    found.push({ id: `w-${item.word.toLowerCase().replace(/[^a-z]+/g, '-')}`, kind: 'word', text: item.word, pos: item.pos, zh: item.zh, note: item.note ?? '', s, r: [start, end] })
  }
  return found
}

/// seen：整套课里已经出过场的卡片。第一次出场的那一课记成 fresh，并把这张卡写进总表（练习场用）
function buildLesson(lesson, allChunks, seen) {
  const timing = readJSON(join(WEB, `content/audio/${lesson.id}.json`))
  const sentences = lesson.paragraphs.flatMap((paragraph, p) =>
    paragraph.en.map((en, k) => ({ en, zh: paragraph.zh[k], p, ...(paragraph.speaker && k === 0 ? { speaker: paragraph.speaker } : {}) })))
  if (sentences.length !== timing.sentences.length) throw new Error(`${lesson.id}：句子 ${sentences.length} 句，时间轴 ${timing.sentences.length} 句，对不上`)
  const cards = [...chunksOf(lesson, allChunks), ...wordsOf(lesson, sentences)].sort((a, b) => a.s - b.s || a.r[0] - b.r[0])
  for (const card of cards) {
    card.fresh = !seen.has(card.id)
    if (!card.fresh) continue
    const { fresh, ...rest } = card
    seen.set(card.id, { ...rest, l: lesson.id, n: lesson.number, en: sentences[card.s].en, szh: sentences[card.s].zh, a: timing.sentences[card.s].start, b: timing.sentences[card.s].end })
  }
  return {
    id: lesson.id, n: lesson.number, unit: lesson.unit.number, title: lesson.title, genre: lesson.genre, words: lesson.words,
    seconds: Math.round(timing.duration), sentences,
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
  for (const name of files) {
    const source = readJSON(join(WEB, 'content/lessons', name))
    const unit = units.find(item => item.n === source.unit.number)
    if (!unit) continue
    const lesson = buildLesson(source, allChunks, seen)
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
