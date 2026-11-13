// 单词的记忆排程：二元间隔重复，照手机 App 的 Learning/BinarySRS.swift 原样搬过来（两边的数必须一样）。
// 每次只答「记得」或「忘了」，就是 Anki 只按 Again / Good 两个键时的 SM-2：
// 新词在本轮里过两遍，都记得才算学会，第一次隔 1 天；复习记得，间隔乘难度系数（起始 2.5）；
// 忘了，系数减 0.2（最低 1.3），本轮过一会儿再来一次，间隔回到 1 天
const MINUTE = 60000
// 一天从凌晨 4 点算起，和课文那边（state.js）一个规矩
const START_HOUR = 4
const LEARNING_STEPS = [1, 10]
const RELEARNING_STEP = 10
const STARTING_EASE = 2.5
const LAPSE_PENALTY = 0.2
const MINIMUM_EASE = 1.3
// 单词一年复习一次足够
const MAXIMUM_INTERVAL = 365
// 「早就会了」：直接算学会，一个月后抽查一次，判断错了会按「忘了」回到重学
const KNOWN_INTERVAL = 30

/// 这个学习日（再往后数 daysAfter 天）是从什么时候开始的。
/// 按墙上的钟取 4 点、按日历加天：直接加减毫秒，在夏令时切换那天会差一小时
export function dayStart(now = Date.now(), daysAfter = 0) {
  const date = new Date(now)
  if (date.getHours() < START_HOUR) date.setDate(date.getDate() - 1)
  date.setHours(START_HOUR, 0, 0, 0)
  date.setDate(date.getDate() + daysAfter)
  return date.getTime()
}

/// phase：new 没学过、learning 本轮正在学、review 学会了等复习、relearning 忘了正在重学。interval 的单位是天
export const fresh = () => ({ phase: 'new', step: 0, interval: 0, ease: STARTING_EASE, due: null, reps: 0, lapses: 0 })

/// 学会过的（「早就会了」的也算）
export const isLearned = card => card.phase === 'review' || card.phase === 'relearning'

function lapse(card, now) {
  return { ...card, lapses: card.lapses + 1, ease: Math.max(MINIMUM_EASE, card.ease - LAPSE_PENALTY), phase: 'relearning', interval: 1, due: now + RELEARNING_STEP * MINUTE }
}

export function answer(card, remembered, now = Date.now()) {
  const next = { ...card, reps: card.reps + 1 }
  if (card.phase === 'new' || card.phase === 'learning') {
    next.step = remembered ? card.step + 1 : 0
    if (next.step >= LEARNING_STEPS.length) return { ...next, phase: 'review', step: 0, interval: 1, due: dayStart(now, 1) }
    return { ...next, phase: 'learning', due: now + LEARNING_STEPS[next.step] * MINUTE }
  }
  if (card.phase === 'review') {
    if (!remembered) return lapse(next, now)
    next.interval = Math.min(MAXIMUM_INTERVAL, Math.max(card.interval + 1, Math.round(card.interval * card.ease)))
    return { ...next, due: dayStart(now, next.interval) }
  }
  return remembered ? { ...next, phase: 'review', due: dayStart(now, next.interval) } : { ...next, due: now + RELEARNING_STEP * MINUTE }
}

export const markKnown = (card, now = Date.now()) => ({ ...card, phase: 'review', step: 0, interval: KNOWN_INTERVAL, due: dayStart(now, KNOWN_INTERVAL) })
