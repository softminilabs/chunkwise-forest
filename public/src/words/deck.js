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
  // 每放一段新的、每停一次就加一：循环读的那一轮看到它变了，就知道自己被顶掉了
  let turn = 0
  const finish = whole => { const done = settle; settle = null; done?.(whole) }
  audio.addEventListener('ended', () => finish(true))
  audio.addEventListener('error', () => finish())

  function start(url, from = 0, to = Infinity) {
    finish()
    audio.src = url
    audio.currentTime = from
    const stop = () => { if (audio.currentTime >= to) { audio.pause(); finish(true) } }
    // timeupdate 一秒才来四次，只靠它会把下一句的头带出来，所以每帧也看一眼；页面在后台时没有帧，还得靠它兜底
    audio.ontimeupdate = stop
    return new Promise(done => {
      settle = done
      const watch = () => { if (settle !== done) return; stop(); if (settle === done) requestAnimationFrame(watch) }
      if (to < Infinity) requestAnimationFrame(watch)
      audio.play().catch(() => finish())
    })
  }

  return {
    /// 放一段录音。返回的 Promise 在放完、被打断、或者放不出来的时候了结：听单词要等上一段完了才放下一段。
    /// from、to：只放其中一段（课文录音里的那一句）
    play(url, from, to) { turn += 1; return start(url, from, to) },
    /// 循环读一段：读完隔 gap() 秒再读，直到放了别的、停了、或者放不出来。
    /// gap 每读完一遍再问一次：中途把循环关了，读完这一遍就停
    async loop(url, gap) {
      const mine = ++turn
      while (await start(url) && mine === turn && gap()) {
        await new Promise(done => setTimeout(done, gap() * 1000))
        if (mine !== turn) return
      }
    },
    stop() { turn += 1; audio.pause(); finish() },
  }
}

/// 例句里把这个词描出来的位置 [从, 到]。词会变形（delivery → deliveries），所以长一点的词去掉最后一个字母再找
export function findIn(sentence, word) {
  const stem = (word.w.length > 4 ? word.w.slice(0, -1) : word.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const hit = new RegExp(`\\b${stem}\\w*`, 'i').exec(sentence)
  return hit ? [hit.index, hit.index + hit[0].length] : null
}
