// 练习场：把收来的卡片（组块和生词）拿出来玩。三种玩法，一轮六张，一两分钟打完。
// 到期该复习的卡优先出；答对的卡往后排，答错的今天还会再来
import { h, stars } from './core.js'
import { t } from '../i18n.js'

const ROUND = 6
const PASS = 0.8
const MODES = {
  match: { title: t('连连看'), sub: t('英文和中文配成对，连着配对有连击') },
  listen: { title: t('听一句'), sub: t('听课文原声，选出这句里出现的那个') },
  cloze: { title: t('填个空'), sub: t('看中文意思，把句子里缺的补上') },
}
const shuffle = list => list.map(item => [Math.random(), item]).sort((a, b) => a[0] - b[0]).map(pair => pair[1])
const surface = card => card.en.slice(card.r[0], card.r[1])
const marked = card => [card.en.slice(0, card.r[0]), h('mark', {}, surface(card)), card.en.slice(card.r[1])]

/// 凑够 count 个不重样的干扰项：先从 near（这一课的、已经收了的）里挑，眼熟的才有迷惑性；不够再从全部卡片里补
function others(card, near, far, count, label, reject = () => false) {
  const seen = new Set([label(card).toLowerCase()])
  const picked = []
  for (const other of [...shuffle(near), ...shuffle(far)]) {
    const text = label(other)
    if (other.id === card.id || seen.has(text.toLowerCase()) || reject(other)) continue
    seen.add(text.toLowerCase())
    picked.push(text)
    if (picked.length === count) break
  }
  return picked
}

/// 只放课文里的某一句：整课的朗读是一个文件，按这句的起止时间掐着放
function createSnippet() {
  const audio = new Audio()
  let stopAt = Infinity
  let raf = 0
  const watch = () => { if (audio.currentTime >= stopAt) return audio.pause(); if (!audio.paused) raf = requestAnimationFrame(watch) }
  return {
    play(card) {
      const src = `data/audio/${card.l}.m4a`
      const start = () => { audio.currentTime = card.a; stopAt = card.b + 0.05; audio.play().then(() => { cancelAnimationFrame(raf); watch() }).catch(() => {}) }
      if (audio.getAttribute('src') === src && audio.readyState > 0) return start()
      audio.src = src
      audio.addEventListener('loadedmetadata', start, { once: true })
    },
    stop() { audio.pause(); cancelAnimationFrame(raf) },
  }
}

function createGame(ctx, lesson, title) {
  const body = h('div', { class: 'practice-body' })
  const dots = h('div', { class: 'dots' })
  const heading = h('h2', {}, title)
  const kicker = h('p', { class: 'kicker' }, '')
  const root = h('section', { class: 'practice sticker', 'aria-label': title },
    h('header', { class: 'reader-head' }, h('div', { class: 'grow' }, kicker, heading), dots, h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
    body)
  // 做干扰项时优先用的卡：跟着课文练是这一课的，练习场是口袋里的
  const known = lesson ? lesson.cards.map(card => ({ ...card, en: lesson.sentences[card.s].en })) : ctx.state.owned().map(id => ctx.cards[id]).filter(Boolean)
  return { ctx, lesson, title, root, body, dots, heading, kicker, known, all: Object.values(ctx.cards), snippet: createSnippet(), keys: null, round: { mode: null, cards: [], index: 0, right: 0, combo: 0, best: 0, missed: new Set() } }
}

/// 练习场里一张卡这次考哪一句。答对升了一格，下次就换它在别的课里出现的那一句来考：
/// 只在学它的那句里认得，不算会用（App 的 PRD 第 8 节「迁移」）。答错打回第一格，又回到学它的那句
const inContext = (card, box) => ({ ...card, ...[card, ...(card.more ?? [])][box % (1 + (card.more?.length ?? 0))] })

/// 这一轮用哪些卡。跟着某一课练：就用那一课的，新卡在前；练习场：到期的先出
function draw(game) {
  const { lesson, ctx } = game
  if (lesson) return shuffle(lesson.cards.map(card => ({ ...card, l: lesson.id, en: lesson.sentences[card.s].en, szh: lesson.sentences[card.s].zh, a: lesson.timing[card.s].a, b: lesson.timing[card.s].b }))).sort((a, b) => Number(b.fresh) - Number(a.fresh)).slice(0, ROUND)
  const due = new Set(ctx.state.due())
  const owned = ctx.state.owned().filter(id => ctx.cards[id]).map(id => inContext(ctx.cards[id], ctx.state.town.cards[id].box))
  return [...shuffle(owned.filter(card => due.has(card.id))), ...shuffle(owned.filter(card => !due.has(card.id)))].slice(0, ROUND)
}

function paintDots(game) {
  const { round } = game
  game.dots.replaceChildren(...round.cards.map((_, k) => h('i', { class: k < round.index ? 'is-done' : k === round.index ? 'is-now' : '' })))
}

function score(game, card, right) {
  const { round, ctx } = game
  ctx.state.review(card.id, right)
  if (right) { round.right += 1; round.combo += 1; round.best = Math.max(round.best, round.combo); ctx.audio.chime(Math.min(6, round.combo + 1)) }
  else { round.combo = 0; ctx.audio.wrong() }
}

function menu(game) {
  const { ctx, body } = game
  game.keys = null
  game.snippet.stop()
  game.kicker.textContent = t('练习场')
  game.heading.textContent = t('今天玩哪个？')
  game.dots.replaceChildren()
  const owned = ctx.state.owned().length
  if (owned < 4) return body.replaceChildren(h('div', { class: 'result' },
    h('p', { class: 'note' }, t('练习场里的卡片是读课文收来的。现在只有 {n} 张，读完一课就够玩了。', { n: owned })),
    h('button', { class: 'button big', type: 'button', onclick: () => { ctx.ui.closeModal(); ctx.continueLearning() } }, t('去读一课'))))
  body.replaceChildren(
    h('p', { class: 'note' }, t('口袋里有 {n} 张卡片，今天该复习 {due} 张。一轮 {round} 张。', { n: owned, due: ctx.state.due().length, round: ROUND })),
    h('div', { class: 'modes' }, Object.entries(MODES).map(([id, item]) => h('button', { class: `mode mode-${id}`, type: 'button', onclick: () => start(game, id) }, h('strong', {}, item.title), h('small', {}, item.sub)))))
}

function start(game, id) {
  Object.assign(game.round, { mode: id, cards: draw(game), index: 0, right: 0, combo: 0, best: 0, missed: new Set() })
  game.kicker.textContent = game.lesson ? t('跟着课文练') : t('练习场')
  game.heading.textContent = game.lesson ? game.title : MODES[id].title
  game.ctx.audio.pop()
  if (id === 'match') match(game)
  else question(game)
}

function match(game) {
  const { round } = game
  game.dots.replaceChildren()
  game.keys = null
  const tile = (card, side) => h('button', { class: `tile-card ${side === 'en' ? `card-${card.kind}` : 'is-zh'}`, type: 'button', lang: side === 'en' ? 'en' : null, 'data-id': card.id, 'data-side': side }, side === 'en' ? card.text : card.zh)
  const view = { picked: { en: null, zh: null }, left: round.cards.length, status: h('p', { class: 'note center' }, t('点一个英文，再点它的中文。')) }
  const grid = h('div', { class: 'match' }, h('div', { class: 'column' }, round.cards.map(card => tile(card, 'en'))), h('div', { class: 'column' }, shuffle(round.cards).map(card => tile(card, 'zh'))))
  grid.addEventListener('click', event => pickTile(game, view, event.target.closest('.tile-card:not(.is-done)')))
  game.body.replaceChildren(grid, view.status)
}

function pickTile(game, view, button) {
  if (!button) return
  const { round, ctx } = game
  const { picked } = view
  picked[button.dataset.side]?.classList.remove('is-picked')
  picked[button.dataset.side] = button
  button.classList.add('is-picked')
  ctx.audio.tap()
  if (!picked.en || !picked.zh) return
  const pair = [picked.en, picked.zh]
  const card = round.cards.find(item => item.id === picked.en.dataset.id)
  const right = picked.en.dataset.id === picked.zh.dataset.id
  picked.en = picked.zh = null
  for (const node of pair) node.classList.remove('is-picked')
  if (!right) {
    round.missed.add(card.id)
    score(game, card, false)
    // 连着配错两次也要再抖一下：先摘掉类名、强制重排，动画才会重播
    for (const node of pair) { node.classList.remove('is-wrong'); void node.offsetWidth; node.classList.add('is-wrong') }
    view.status.textContent = t('不是一对，再看看。')
    return
  }
  score(game, card, !round.missed.has(card.id))
  for (const node of pair) { node.classList.add('is-done'); node.disabled = true }
  view.status.textContent = round.combo > 1 ? t('连击 ×{n}', { n: round.combo }) : t('对了！')
  view.left -= 1
  if (view.left === 0) setTimeout(() => result(game), 500)
}

/// 一张卡出成什么题。填空的空太长（跨了大半句的组块）就改问意思
function ask(game, card) {
  const { known, all, snippet, round } = game
  if (round.mode === 'listen') return { prompt: [h('button', { class: 'button dark big', type: 'button', onclick: () => snippet.play(card) }, t('▶ 再听一遍')), h('p', { class: 'q-hint' }, t('这句里出现了哪一个？'))], answer: card.text, wrong: others(card, known, all, 3, other => other.text, other => card.en.toLowerCase().includes(other.text.toLowerCase())), speak: true }
  if (surface(card).length > 28) return { prompt: [h('p', { class: 'q-zh big' }, card.zh), h('p', { class: 'q-hint' }, t('哪一个是这个意思？'))], answer: card.text, wrong: others(card, known, all, 3, other => other.text) }
  const sameKind = other => other.kind === card.kind
  return { prompt: [h('p', { class: 'q-zh' }, card.szh), h('p', { class: 'q-en', lang: 'en' }, card.en.slice(0, card.r[0]), h('span', { class: 'blank' }, '?'), card.en.slice(card.r[1]))], answer: surface(card), wrong: others(card, known.filter(sameKind), all.filter(sameKind), 3, surface) }
}

function question(game) {
  const { round } = game
  const card = round.cards[round.index]
  if (!card) return result(game)
  paintDots(game)
  const { prompt, answer, wrong, speak } = ask(game, card)
  const view = { card, speak, answered: false, after: h('div', { class: 'q-after', hidden: true }) }
  view.options = h('div', { class: 'options' }, shuffle([answer, ...wrong]).map((text, k) => h('button', { class: 'option', type: 'button', lang: 'en', 'data-right': text === answer ? '1' : null }, h('kbd', {}, String(k + 1)), text)))
  view.next = () => { round.index += 1; question(game) }
  view.options.addEventListener('click', event => choose(game, view, event.target.closest('.option')))
  game.keys = event => {
    if (/^[1-4]$/.test(event.key)) choose(game, view, view.options.children[Number(event.key) - 1])
    else if (view.answered && (event.code === 'Enter' || event.code === 'Space')) { event.preventDefault(); view.next() }
  }
  game.body.replaceChildren(h('div', { class: 'q' }, prompt, view.options, view.after))
  if (speak) game.snippet.play(card)
}

function choose(game, view, button) {
  if (view.answered || !button) return
  const { card } = view
  const { round } = game
  view.answered = true
  const right = button.dataset.right === '1'
  score(game, card, right)
  for (const option of view.options.children) option.disabled = true
  view.options.querySelector('[data-right]').classList.add('is-right')
  if (!right) button.classList.add('is-wrong')
  view.after.replaceChildren(h('p', { class: 'q-full', lang: 'en' }, marked(card)), h('p', { class: 'q-zh' }, card.szh), h('p', { class: 'q-note' }, h('b', {}, card.text), ` ${card.pos ?? ''} ${card.zh}`),
    h('button', { class: 'button', type: 'button', onclick: view.next }, round.index + 1 === round.cards.length ? t('看结果') : t('下一题')))
  view.after.hidden = false
  // 听一句的题已经放过原声了；另外两种答完放一遍，把这句话的声音和意思连起来
  if (!view.speak) game.snippet.play(card)
}

/// 跟着课文练：过关就给这一课第二颗星
function verdict(game, passed) {
  const { lesson, ctx, round } = game
  if (!lesson) return t('最长连击 {n}。', { n: round.best })
  const had = ctx.state.stars(lesson.id)
  if (!passed) return t('对八成就能拿第二颗星，再来一轮？')
  ctx.state.finish(lesson, 2)
  ctx.onLesson(lesson)
  return had >= 2 ? t('第二颗星早就是你的了。') : t('第 {n} 课拿到第二颗星，门口那盏灯更亮了。', { n: lesson.n })
}

function result(game) {
  const { round, ctx, lesson } = game
  game.keys = null
  game.snippet.stop()
  round.index = round.cards.length
  if (round.mode !== 'match') paintDots(game)
  const total = round.cards.length
  const passed = round.mode === 'match' ? round.missed.size <= 1 : round.right / total >= PASS
  const line = verdict(game, passed)
  const title = round.mode === 'match' ? (round.missed.size ? t('配完了，错了 {n} 次', { n: round.missed.size }) : t('一次都没错！')) : (round.right === total ? t('全对！') : t('对了 {right} / {total}', { right: round.right, total }))
  if (passed) ctx.audio.chime(6)
  game.body.replaceChildren(h('div', { class: `result ${passed ? 'is-win' : ''}` },
    passed && h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, k) => h('i', { style: `--a:${k * 26}deg;--d:${80 + (k % 4) * 26}px` }))),
    h('p', { class: 'kicker' }, MODES[round.mode].title),
    h('h2', {}, title, lesson && passed ? stars(2) : null),
    h('p', { class: 'note' }, line),
    h('div', { class: 'row center' },
      h('button', { class: 'button big', type: 'button', onclick: () => start(game, round.mode) }, t('再来一轮')),
      !lesson && h('button', { class: 'button plain big', type: 'button', onclick: () => menu(game) }, t('换个玩法')),
      h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.ui.closeModal() }, t('回森林')))))
}

export function openPractice(ctx, { mode = null, lesson = null, title = t('练习场') } = {}) {
  const game = createGame(ctx, lesson, title)
  const onKey = event => { if (!event.metaKey && !event.ctrlKey) game.keys?.(event) }
  addEventListener('keydown', onKey)
  ctx.ui.openModal(game.root, () => { game.snippet.stop(); removeEventListener('keydown', onKey) })
  if (mode) start(game, mode)
  else menu(game)
}
