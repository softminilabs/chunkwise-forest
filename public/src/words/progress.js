// 单词的学习进度，存在这台电脑的浏览器里（cw.words），和课文的进度分开存：
// 词有六千多个，不想每次存课文进度都把它们重写一遍
import { answer as schedule, dayStart, fresh, isLearned, markKnown } from './srs.js'

export const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2']
export const DAILY = [5, 10, 15, 20]
const read = () => { try { return JSON.parse(localStorage.getItem('cw.words')) ?? {} } catch { return {} } }
const dayKey = now => { const date = new Date(dayStart(now)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

export function createWordProgress() {
  // cards：碰过的词 → 排程，外加 lv（它是哪一级的，复习时要去那一级的文件里找它）、at（哪一刻学会的）。
  // newByDay：每个学习日学了几个新词；today：今天碰过哪些词（「听今天的词」放的就是它们）
  const store = { cards: {}, newByDay: {}, today: { day: '', ids: [] }, level: 'B1', daily: 10, ...read() }
  const listeners = new Set()
  const save = () => { try { localStorage.setItem('cw.words', JSON.stringify(store)) } catch {} for (const listener of listeners) listener() }
  const card = id => store.cards[id] ?? fresh()

  /// 记一笔：这个词今天碰过了；它要是新词，今天的新词数加一
  function touch(id, before, now) {
    const day = dayKey(now)
    if (store.today.day !== day) store.today = { day, ids: [] }
    if (!store.today.ids.includes(id)) store.today.ids.push(id)
    if (before.phase === 'new') store.newByDay[day] = (store.newByDay[day] ?? 0) + 1
  }

  function settle(id, level, before, next, now) {
    touch(id, before, now)
    store.cards[id] = { ...next, lv: level, at: isLearned(next) ? before.at ?? now : before.at }
    save()
    return store.cards[id]
  }

  return {
    store, card,
    on(listener) { listeners.add(listener) },
    set(values) { Object.assign(store, values); save() },
    answer: (id, level, remembered, now = Date.now()) => settle(id, level, card(id), schedule(card(id), remembered, now), now),
    know: (id, level, now = Date.now()) => settle(id, level, card(id), markKnown(card(id), now), now),
    isLearned: id => isLearned(card(id)),

    /// 到期的复习，早到期的在前（本轮里还在学习步骤中的也算）。返回 [{ id, lv }]
    due(now = Date.now()) {
      const end = dayStart(now, 1)
      return Object.entries(store.cards).filter(([, item]) => item.phase !== 'new' && item.due < end).sort((a, b) => a[1].due - b[1].due).map(([id, item]) => ({ id, lv: item.lv }))
    },
    /// 明天这个时候之前会到期几个
    dueTomorrow(now = Date.now()) {
      const [from, to] = [dayStart(now, 1), dayStart(now, 2)]
      return Object.values(store.cards).filter(item => item.due >= from && item.due < to).length
    },
    newToday: (now = Date.now()) => store.newByDay[dayKey(now)] ?? 0,
    /// 这一级里还没学过的词，照词库的顺序取前 count 个
    newWords: (words, count) => words.filter(word => card(word.id).phase === 'new').slice(0, count),
    /// 学会的词，最近学会的在前。返回 [{ id, lv }]
    learned() {
      return Object.entries(store.cards).filter(([, item]) => isLearned(item)).sort((a, b) => (b[1].at ?? 0) - (a[1].at ?? 0)).map(([id, item]) => ({ id, lv: item.lv }))
    },
    /// 今天碰过的词。返回 [{ id, lv }]
    today(now = Date.now()) {
      return store.today.day === dayKey(now) ? store.today.ids.map(id => ({ id, lv: store.cards[id].lv })) : []
    },
  }
}
