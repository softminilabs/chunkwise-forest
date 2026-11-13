// 词库：public/words/ 里的词和录音（npm run words 生成）。一个级别一个文件，用到哪一级才取
const files = new Map()
let index = null
const json = async url => (await fetch(url)).json()

/// 目录：一共多少词、每个级别多少、每个级别里每个话题多少、话题的名字
export const loadIndex = async () => (index ??= await json('words/index.json'))

export async function loadLevel(level) {
  if (!files.has(level)) files.set(level, json(`words/${level.toLowerCase()}.json`))
  return files.get(level)
}

/// 把 [{ id, lv }] 换成词本身，顺序不变。它们可能分在好几个级别的文件里
export async function wordsOf(refs) {
  const levels = new Map(await Promise.all([...new Set(refs.map(ref => ref.lv))].map(async level => [level, new Map((await loadLevel(level)).map(word => [word.id, word]))])))
  return refs.map(ref => levels.get(ref.lv)?.get(ref.id)).filter(Boolean)
}

/// kind：uk 英音、us 美音、ex 第一条例句、ex2 第二条例句（只有一部分词有）
export const soundUrl = (kind, word) => `words/audio/${kind}/${word.id}.mp3`

export function createVoice() {
  const audio = new Audio()
  let settle = null
  const finish = () => { const done = settle; settle = null; done?.() }
  audio.addEventListener('ended', finish)
  audio.addEventListener('error', finish)
  return {
    /// 放一段录音。返回的 Promise 在放完、被打断、或者放不出来的时候了结：听单词要等上一段完了才放下一段。
    /// from、to：只放其中一段（课文录音里的那一句）
    play(url, from = 0, to = Infinity) {
      finish()
      audio.src = url
      audio.currentTime = from
      audio.ontimeupdate = () => { if (audio.currentTime >= to) { audio.pause(); finish() } }
      return new Promise(done => { settle = done; audio.play().catch(finish) })
    },
    stop() { audio.pause(); finish() },
  }
}

/// 例句里把这个词描出来的位置 [从, 到]。词会变形（delivery → deliveries），所以长一点的词去掉最后一个字母再找
export function findIn(sentence, word) {
  const stem = (word.w.length > 4 ? word.w.slice(0, -1) : word.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`\\b${stem}\\w*`, 'i').exec(sentence)
  return hit ? [hit.index, hit.index + hit[0].length] : null
}
