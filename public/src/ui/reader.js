// 读课文。朗读到哪句、哪个词，哪里就亮；点一句从那句读。
// 三种听法：看着听、盲听（没听过的句子先糊着）、跟读（每句读完停下来，等你照着念）。听完整篇才算读完，门口那盏灯才亮
import { h, stars } from './core.js'
import { buildSide } from './reader-side.js'
import { buildReader, clock, icon } from './reader-view.js'

const SPEEDS = [1, 0.8, 1.2]
const MODES = { read: '看着听', blind: '盲听', shadow: '跟读' }
const ZH = [['line', '中文 当前句'], ['all', '中文 全文'], ['off', '中文 关']]
const HINTS = { read: '点播放开始听，也可以直接点任何一句。划了线的词点一下看解释。', blind: '盲听：没听过的句子先糊着，听完一句显一句。', shadow: '跟读：每句读完会停一下，轮到你照着念。' }

/// 一句算读到哪儿为止。时间轴里有的句子结束得比下一句开始还晚几十毫秒，照着结束时间等就永远等不到：取两者里早的那个
const endOf = (lesson, i) => Math.min(lesson.timing[i].b, lesson.timing[i + 1]?.a ?? Infinity)

/// 课文底下那一条写什么：等跟读时是提示，否则是当前这句的中文（没开「当前句」就写这种听法的说明）
function lineText(session) {
  if (session.waiting) return '轮到你了，照着念这一句。'
  if (session.mode === 'blind' || ZH[session.zh][0] !== 'line' || session.now < 0) return HINTS[session.mode]
  return session.lesson.sentences[session.now].zh
}

/// 读到第 i 句：亮起来、底下换成这句的中文、右边对应的卡片亮起来、滚到看得见的地方
function show(session, i) {
  const { view } = session
  if (i === session.now) return
  view.sentences[session.now]?.classList.remove('is-now')
  view.sentences[session.now]?.querySelector('.w.is-now')?.classList.remove('is-now')
  session.now = i
  session.word = -1
  view.line.textContent = lineText(session)
  view.side.live(i)
  const node = view.sentences[i]
  if (!node) return
  node.classList.add('is-now')
  const box = node.getBoundingClientRect()
  const frame = view.scroll.getBoundingClientRect()
  if (box.top < frame.top + 40 || box.bottom > frame.bottom - 60) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function markHeard(session, i) {
  const { view } = session
  if (session.heard.has(i)) return
  session.heard.add(i)
  view.sentences[i]?.classList.add('is-heard')
  view.ticks[i]?.classList.add('is-heard')
  view.ring.set(session.heard.size)
}

function cancelWait(session) {
  clearTimeout(session.waiting)
  session.waiting = 0
  session.view.root.classList.remove('is-waiting')
  session.view.line.textContent = lineText(session)
}

/// 跟读：这句读完先停下，留出比这句略长的时间给人念，再接着读下一句
function wait(session, i) {
  const { view, lesson, audio } = session
  const item = lesson.timing[i]
  const ms = (item.b - item.a) * 1150 / audio.playbackRate + 600
  audio.pause()
  view.root.style.setProperty('--wait', `${ms}ms`)
  view.root.classList.add('is-waiting')
  session.waiting = setTimeout(() => {
    cancelWait(session)
    if (lesson.timing[i + 1]) audio.currentTime = lesson.timing[i + 1].a
    audio.play().catch(() => {})
  }, ms)
  view.line.textContent = lineText(session)
}

/// 一句读到头了。返回 true 表示已经停下来等跟读，这一帧不用再往下画
function sentenceEnd(session, i) {
  markHeard(session, i)
  if (session.loop) { session.audio.currentTime = session.lesson.timing[i].a; session.ended = -1; return false }
  if (session.mode !== 'shadow') return false
  wait(session, i)
  return true
}

function paint(session, t, i) {
  const { view, lesson, audio } = session
  const k = (lesson.timing[i]?.w ?? []).findIndex(([from, to]) => t >= from && t < to)
  if (k !== session.word && k >= 0) {
    view.sentences[i].querySelector('.w.is-now')?.classList.remove('is-now')
    view.sentences[i].querySelector(`.w[data-w="${k}"]`)?.classList.add('is-now')
    session.word = k
  }
  const part = Math.min(1, t / (audio.duration || lesson.duration))
  view.fill.style.width = `${part * 100}%`
  view.thumb.style.left = `${part * 100}%`
  view.time.textContent = `${clock(t)} / ${clock(audio.duration || lesson.duration)}`
}

/// timeupdate 一秒只来四次，逐词点亮会一卡一卡：播放时按动画帧跟
function tick(session) {
  const { lesson, audio } = session
  cancelAnimationFrame(session.raf)
  const playing = session.playing
  if (!audio.paused && playing >= 0 && session.ended !== playing && audio.currentTime >= endOf(lesson, playing)) {
    session.ended = playing
    if (sentenceEnd(session, playing)) return
  }
  const t = audio.currentTime
  const i = lesson.timing.findIndex((item, k) => t >= item.a && t < (lesson.timing[k + 1]?.a ?? Infinity))
  if (!audio.paused && i !== session.playing) { session.playing = i; session.ended = -1 }
  show(session, i)
  paint(session, t, i)
  if (!audio.paused) session.raf = requestAnimationFrame(() => tick(session))
}

function jump(session, i) {
  const { lesson, audio } = session
  const target = Math.min(lesson.timing.length - 1, Math.max(0, i))
  cancelWait(session)
  session.playing = target
  session.ended = -1
  audio.currentTime = lesson.timing[target].a
  audio.play().catch(() => {})
  tick(session)
}

function toggle(session) {
  const { audio } = session
  // 正等着跟读时按播放：不等了，接着往下读
  if (session.waiting) { cancelWait(session); return audio.play().catch(() => {}) }
  return audio.paused ? audio.play().catch(() => {}) : audio.pause()
}

function setMode(session, mode) {
  const { view } = session
  cancelWait(session)
  session.mode = mode
  for (const button of view.modes.children) button.classList.toggle('is-on', button.dataset.mode === mode)
  view.root.classList.toggle('is-blind', mode === 'blind')
  view.line.textContent = lineText(session)
}

function setZh(session, k) {
  session.zh = k % ZH.length
  session.view.zh.textContent = ZH[session.zh][1]
  session.view.root.dataset.zh = ZH[session.zh][0]
  session.view.line.textContent = lineText(session)
}

function setLoop(session, on) {
  session.loop = on
  session.view.loop.setAttribute('aria-pressed', String(on))
}

function nextSpeed(session) {
  session.speed = (session.speed + 1) % SPEEDS.length
  session.audio.playbackRate = SPEEDS[session.speed]
  session.view.speed.textContent = `${SPEEDS[session.speed]}×`
}

function guessLine(session) {
  const { pre } = session.lesson
  if (!pre) return null
  const lead = session.picked == null ? '开头那道题的答案：' : session.picked === pre.answer ? '开头那道题你猜对了：' : '开头那道题，答案其实是：'
  return h('p', { class: 'note' }, lead, h('b', { lang: 'en' }, pre.options[pre.answer]))
}

function resultNode(session, outcome) {
  const { ctx, lesson } = session
  const index = ctx.state.lessons.findIndex(item => item.id === lesson.id)
  const next = ctx.state.lessons[index + 1]
  const count = outcome.fresh.length
  return h('div', { class: 'result' },
    h('p', { class: 'kicker' }, '听完了'),
    h('h2', {}, `第 ${lesson.n} 课的灯亮了 `, stars(ctx.state.stars(lesson.id))),
    guessLine(session),
    h('p', { class: 'note' }, count ? `收下 ${count} 张新卡片，练习场里可以玩了：` : '这一课的卡片你都收过了。'),
    h('div', { class: 'cards' }, outcome.fresh.map((card, k) => h('div', { class: `card card-${card.kind}`, style: `animation-delay:${k * 60}ms` }, h('strong', {}, card.text), h('small', {}, card.zh)))),
    h('div', { class: 'row center' },
      h('button', { class: 'button big', type: 'button', onclick: () => ctx.openPractice({ mode: 'cloze', lesson, title: `第 ${lesson.n} 课 · 练一练` }) }, '练一练，再拿一颗星'),
      next && h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openLesson(next) }, `下一课：${next.title}`),
      h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openLesson(ctx.state.lessons[index]) }, '再听一遍'),
      h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.ui.closeModal() }, '回森林')))
}

function finish(session) {
  const { ctx, lesson, view } = session
  if (session.finished) return
  session.finished = true
  cancelWait(session)
  lesson.sentences.forEach((_, i) => markHeard(session, i))
  const outcome = ctx.state.finish(lesson, 1)
  ctx.audio.chime(4)
  view.main.replaceChildren(resultNode(session, outcome))
  view.bar.hidden = true
  ctx.onLesson(lesson)
}

/// 进度条：点和拖都行
function bindSeek(session) {
  const { view, audio, lesson } = session
  const move = event => {
    const box = view.seek.getBoundingClientRect()
    cancelWait(session)
    audio.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * (audio.duration || lesson.duration)
    session.ended = -1
    tick(session)
  }
  view.seek.addEventListener('pointerdown', event => { view.seek.setPointerCapture(event.pointerId); session.dragging = true; move(event) })
  view.seek.addEventListener('pointermove', event => { if (session.dragging) move(event) })
  view.seek.addEventListener('pointerup', () => { session.dragging = false })
  view.seek.addEventListener('click', move)
}

const KEYS = {
  Space: toggle,
  ArrowRight: session => jump(session, session.now + 1),
  ArrowLeft: session => jump(session, session.now - 1),
  KeyL: session => setLoop(session, !session.loop),
  KeyZ: session => setZh(session, session.zh + 1),
  KeyS: nextSpeed,
  KeyM: session => { const ids = Object.keys(MODES); setMode(session, ids[(ids.indexOf(session.mode) + 1) % ids.length]) },
}

function bind(session) {
  const { view, audio } = session
  session.onKey = event => {
    const action = KEYS[event.code]
    if (!action || session.finished || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    action(session)
  }
  audio.addEventListener('play', () => { view.play.replaceChildren(icon('pause')); view.play.setAttribute('aria-label', '暂停'); tick(session) })
  audio.addEventListener('pause', () => { view.play.replaceChildren(icon('play')); view.play.setAttribute('aria-label', '播放') })
  audio.addEventListener('timeupdate', () => tick(session))
  audio.addEventListener('ended', () => finish(session))
  view.play.addEventListener('click', () => toggle(session))
  view.prev.addEventListener('click', () => jump(session, session.now - 1))
  view.next.addEventListener('click', () => jump(session, session.now + 1))
  view.modes.addEventListener('click', event => { const button = event.target.closest('[data-mode]'); if (button) setMode(session, button.dataset.mode) })
  view.loop.addEventListener('click', () => setLoop(session, !session.loop))
  view.speed.addEventListener('click', () => nextSpeed(session))
  view.zh.addEventListener('click', () => setZh(session, session.zh + 1))
  view.cards.addEventListener('click', () => view.side.root.classList.toggle('is-up'))
  view.pre?.addEventListener('click', event => {
    const option = event.target.closest('.pre-option')
    if (!option) return
    for (const other of view.pre.querySelectorAll('.pre-option')) other.classList.toggle('is-picked', other === option)
    session.picked = Number(option.dataset.k)
  })
  // 划了线的词点一下是看解释，句子别的地方点一下是从这句读
  view.article.addEventListener('click', event => {
    const mark = event.target.closest('[data-card]')
    if (mark) return matchMedia('(max-width: 860px)').matches ? view.side.reveal(mark.dataset.card) : view.side.open(mark.dataset.card)
    const node = event.target.closest('.s')
    if (node && !getSelection()?.toString()) jump(session, Number(node.dataset.i))
  })
  bindSeek(session)
  addEventListener('keydown', session.onKey)
}

export async function openReader(ctx, meta) {
  const lesson = await (await fetch(`data/lessons/${meta.id}.json`)).json()
  const audio = new Audio(`data/audio/${meta.id}.m4a`)
  const session = { ctx, lesson, audio, mode: 'read', loop: false, zh: 0, speed: 0, now: -1, word: -1, playing: -1, ended: -1, heard: new Set(), waiting: 0, raf: 0, finished: false, picked: null, dragging: false, onKey: null }
  session.view = buildReader(ctx, lesson, buildSide(ctx, lesson, i => jump(session, i)), MODES)
  bind(session)
  setZh(session, 0)
  ctx.ui.openModal(session.view.root, () => { audio.pause(); cancelAnimationFrame(session.raf); clearTimeout(session.waiting); removeEventListener('keydown', session.onKey) })
  return { audio, lesson }
}
