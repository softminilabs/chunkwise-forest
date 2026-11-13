// 单词屋的词库：从旁边的 Chunkwise（手机 App）项目的单词本整理过来，放在 public/words/，不进仓库。
// 只要文字和录音，插画不拷。来源是 Word Atlas contributors（CC BY 4.0，页面上要署名），详见那边的 content/wordatlas/README.md
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

const FROM = '../Chunkwise/content/wordatlas'
const OUT = 'public/words'
const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2']
// 话题的顺序和中文名照手机 App（Data/WordDeck.swift）
const TOPICS = [['daily', '日常'], ['society', '社会'], ['thinking', '思维'], ['work', '工作'], ['nature', '自然'], ['health', '健康'], ['emotion', '情感'], ['education', '教育'], ['science', '科学'], ['travel', '旅行'],
  ['technology', '科技'], ['economy', '经济'], ['government', '政府'], ['arts', '艺术'], ['environment', '环境'], ['history', '历史'], ['city', '城市'], ['media', '媒体'], ['sport', '运动']]
// uk、us：单词的英音、美音；ex：第一条例句；ex2：一部分词的第二条例句也有录音
const AUDIO = ['uk', 'us', 'ex', 'ex2']

if (!existsSync(`${FROM}/deck.json`)) throw new Error(`没找到单词本：${FROM}/deck.json`)
const deck = JSON.parse(readFileSync(`${FROM}/deck.json`, 'utf8')).words
const second = new Set(readdirSync(`${FROM}/audio/ex2`).map(name => name.replace(/\.mp3$/, '')))
mkdirSync(OUT, { recursive: true })

// 一个级别一个文件，点到哪一级才取哪一级。单词本里本来就是先学的在前（按课文和视频里出现的次数排的），顺序不动
const levels = LEVELS.map(level => {
  const words = deck.filter(word => word.cefr === level).map(({ id, w, uk, us, topic, senses, ex, col, fam, tip }) => ({ id, w, uk, us, topic, senses, ex, col, fam, tip, ...(second.has(id) && { x2: true }) }))
  writeFileSync(`${OUT}/${level.toLowerCase()}.json`, JSON.stringify(words))
  const topics = Object.fromEntries(TOPICS.map(([topic]) => [topic, words.filter(word => word.topic === topic).length]).filter(([, count]) => count))
  return { id: level, count: words.length, topics }
})
writeFileSync(`${OUT}/index.json`, JSON.stringify({ total: levels.reduce((sum, level) => sum + level.count, 0), levels, topics: TOPICS }))

// 录音有三百多兆、两万个文件：已经拷齐的（文件数对得上）就不再拷
for (const kind of AUDIO) {
  const [from, to] = [`${FROM}/audio/${kind}`, `${OUT}/audio/${kind}`]
  if (existsSync(to) && readdirSync(to).length === readdirSync(from).length) continue
  cpSync(from, to, { recursive: true })
}
console.log(`词库：${levels.map(level => `${level.id} ${level.count}`).join('、')}，共 ${levels.reduce((sum, level) => sum + level.count, 0)} 个词；录音 ${AUDIO.map(kind => `${kind} ${readdirSync(`${OUT}/audio/${kind}`).length}`).join('、')}`)
