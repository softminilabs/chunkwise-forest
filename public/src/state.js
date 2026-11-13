// 学习记录存在这台电脑的浏览器里，没有登录。读过 / 听完沿用网页版的键（cw.visited、cw.done），
// 两个站放在同一个域名下时进度是通的；森林自己多出来的东西都在 cw.town 里
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`cw.${key}`)) ?? fallback } catch { return fallback } }
const write = (key, value) => { try { localStorage.setItem(`cw.${key}`, JSON.stringify(value)) } catch {} }
const DAY = 86400000
const RIGHT_GOAL = 5
// 卡片的复习间隔（天）：答对往后挪一格，答错回到第一格，今天还会再出现
const BOXES = [0, 1, 2, 4, 8, 16, 30]
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function createState(course) {
  const saved = read('town', {})
  // scene：季节、昼夜跟着真实的日子和时间（auto），或者固定；mix：每种环境声是自动、常开还是关；chests：找到了哪些宝箱
  const town = { stars: {}, cards: {}, days: {}, first: Date.now(), goal: 1, sound: true, volume: 0.8, mix: {}, chests: {}, ...saved, scene: { season: 'auto', time: 'auto', weather: 'clear', ...saved.scene } }
  // 在网页版里听完的课，到森林里直接算一颗星
  for (const id of Object.keys(read('done', {}))) town.stars[id] ??= 1
  const listeners = new Set()
  const lessons = course.units.flatMap(unit => unit.lessons)
  const today = () => (town.days[dayKey()] ??= { lessons: 0, right: 0 })
  const save = () => { write('town', town); for (const listener of listeners) listener() }
  const studied = offset => (town.days[dayKey(new Date(Date.now() - offset * DAY))]?.lessons ?? 0) > 0

  return {
    town, lessons, save,
    on(listener) { listeners.add(listener) },
    patch(values) { Object.assign(town, values); save() },
    stars: id => town.stars[id] ?? 0,

    /// 一课拿到几颗星。返回这次新增了什么，界面拿去庆祝
    finish(lesson, stars) {
      const before = town.stars[lesson.id] ?? 0
      const fresh = lesson.cards.filter(card => !town.cards[card.id])
      for (const card of fresh) town.cards[card.id] = { box: 0, due: Date.now() }
      if (before === 0) today().lessons += 1
      town.stars[lesson.id] = Math.max(before, stars)
      write('visited', { ...read('visited', {}), [lesson.id]: true })
      write('done', { ...read('done', {}), [lesson.id]: true })
      write('last', lesson.id)
      save()
      return { gained: Math.max(0, stars - before), fresh }
    },

    /// 练习里答了一张卡
    review(id, right) {
      const card = town.cards[id]
      if (right) today().right += 1
      if (card) {
        card.box = right ? Math.min(BOXES.length - 1, card.box + 1) : 0
        card.due = Date.now() + BOXES[card.box] * DAY
      }
      save()
    },
    owned: () => Object.keys(town.cards),
    due: () => Object.entries(town.cards).filter(([, card]) => card.due <= Date.now()).map(([id]) => id),

    /// 连续几天：今天还没学也不断，只要昨天学了
    streak() {
      let count = 0
      for (let offset = studied(0) ? 0 : 1; studied(offset); offset++) count += 1
      return count
    },
    week: () => Array.from({ length: 7 }, (_, k) => studied(6 - k)),
    mission() {
      const day = today()
      return { lessons: Math.min(day.lessons, town.goal), goal: town.goal, right: Math.min(day.right, RIGHT_GOAL), rightGoal: RIGHT_GOAL, done: day.lessons >= town.goal && day.right >= RIGHT_GOAL }
    },
    next: () => lessons.find(lesson => !town.stars[lesson.id]) ?? lessons.find(lesson => town.stars[lesson.id] < 2) ?? lessons[0],
    totals: () => ({ lit: lessons.filter(lesson => town.stars[lesson.id]).length, lessons: lessons.length, cards: Object.keys(town.cards).length, cardTotal: course.cardTotal, days: Math.floor((Date.now() - town.first) / DAY) + 1 }),
  }
}
