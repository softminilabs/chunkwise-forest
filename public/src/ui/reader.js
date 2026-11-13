// 读课文：朗读到哪句、哪个词，哪里就亮；点一句从那句读。听完整篇才算读完，门口那盏灯才亮
import { h, stars } from './core.js'

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const SPEEDS = [1, 0.8, 1.2]

/// 一句话拆成一个个词（朗读时逐词点亮），组块和生词所在的那一段套上标记
function sentenceNode(sentence, index, words, marks) {
  const node = h('span', { class: 's', 'data-i': index })
  const markOf = (from, to) => marks.find(mark => from >= mark.r[0] && to <= mark.r[1])?.kind
  const piece = (from, to, word) => {
    const kind = markOf(from, to)
    const text = sentence.en.slice(from, to)
    if (word == null && !kind) return text
    return h('span', { class: [word != null && 'w', kind && `m-${kind}`].filter(Boolean).join(' '), 'data-w': word }, text)
  }
  let cursor = 0
  words.forEach(([, , at, length], k) => {
    if (at > cursor) node.append(piece(cursor, at))
    node.append(piece(at, at + length, k))
    cursor = at + length
  })
  if (cursor < sentence.en.length) node.append(piece(cursor, sentence.en.length))
  return node
}

function textNode(lesson) {
  const root = h('div', { class: 'reader-text', lang: 'en' })
  let paragraph = null
  lesson.sentences.forEach((sentence, i) => {
    if (!paragraph || sentence.p !== lesson.sentences[i - 1].p) root.append(paragraph = h('p', { class: 'para' }))
    if (sentence.speaker) paragraph.append(h('b', { class: 'speaker' }, sentence.speaker))
    paragraph.append(sentenceNode(sentence, i, lesson.timing[i].w, lesson.cards.filter(card => card.s === i)), ' ')
  })
  return root
}

function resultNode(lesson, outcome, actions) {
  const count = outcome.fresh.length
  return h('div', { class: 'result' },
    h('p', { class: 'kicker' }, '听完了'),
    h('h2', {}, `第 ${lesson.n} 课的灯亮了 `, stars(1)),
    h('p', { class: 'note' }, count ? `收下 ${count} 张新卡片，练习场里可以玩了：` : '这一课的卡片你都收过了。'),
    h('div', { class: 'cards' }, outcome.fresh.map((card, k) => h('div', { class: `card card-${card.kind}`, style: `animation-delay:${k * 60}ms` }, h('strong', {}, card.text), h('small', {}, card.zh)))),
    h('div', { class: 'row center' },
      h('button', { class: 'button big', type: 'button', onclick: actions.drill }, '练一练，再拿一颗星'),
      h('button', { class: 'button plain big', type: 'button', onclick: actions.close }, '回小镇')))
}

function readerView(ctx, lesson) {
  const text = textNode(lesson)
  const view = {
    text, sentences: [...text.querySelectorAll('.s')],
    play: h('button', { class: 'play', type: 'button', 'aria-label': '播放' }, '▶'),
    fill: h('i'),
    time: h('span', { class: 'time' }, `0:00 / ${clock(lesson.seconds)}`),
    speed: h('button', { class: 'chip', type: 'button' }, '1×'),
    zhToggle: h('button', { class: 'chip is-on', type: 'button', 'aria-pressed': 'true' }, '中文'),
    zh: h('p', { class: 'reader-zh' }, '点 ▶ 开始听；也可以直接点任何一句。'),
  }
  view.seek = h('div', { class: 'seek', role: 'slider', 'aria-label': '进度', tabindex: 0 }, view.fill)
  view.bar = h('footer', { class: 'reader-bar' }, view.play, view.seek, view.time, view.speed, view.zhToggle)
  view.body = h('div', { class: 'reader-body' }, text, view.zh)
  view.root = h('section', { class: 'reader sticker', 'aria-label': lesson.title },
    h('header', { class: 'reader-head' },
      h('div', { class: 'grow' }, h('p', { class: 'kicker' }, `单元 ${lesson.unit} · 第 ${lesson.n} 课 · ${Math.max(1, Math.round(lesson.seconds / 60))} 分钟`), h('h2', { lang: 'en' }, lesson.title)),
      h('button', { class: 'close', type: 'button', 'aria-label': '关上', onclick: () => ctx.ui.closeModal() }, '✕')),
    view.body, view.bar)
  return view
}

/// 读到第 i 句：亮起来、底下换成这句的中文、滚到看得见的地方
function show(session, i) {
  const { view, lesson } = session
  if (i === session.now) return
  view.sentences[session.now]?.classList.remove('is-now')
  view.sentences[session.now]?.querySelector('.w.is-now')?.classList.remove('is-now')
  session.now = i
  session.word = -1
  const node = view.sentences[i]
  if (!node) return
  node.classList.add('is-now')
  view.zh.textContent = lesson.sentences[i].zh
  const box = node.getBoundingClientRect()
  const frame = view.text.getBoundingClientRect()
  if (box.top < frame.top + 8 || box.bottom > frame.bottom - 8) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/// timeupdate 一秒只来四次，逐词点亮会一卡一卡：播放时按动画帧跟
function tick(session) {
  const { view, lesson, audio } = session
  const t = audio.currentTime
  const i = lesson.timing.findIndex((item, k) => t >= item.a && t < (lesson.timing[k + 1]?.a ?? Infinity))
  show(session, i)
  const k = (lesson.timing[i]?.w ?? []).findIndex(([from, to]) => t >= from && t < to)
  if (k !== session.word && k >= 0) {
    view.sentences[i].querySelector('.w.is-now')?.classList.remove('is-now')
    view.sentences[i].querySelector(`.w[data-w="${k}"]`)?.classList.add('is-now')
    session.word = k
  }
  view.fill.style.width = `${Math.min(100, t / (audio.duration || lesson.seconds) * 100)}%`
  view.time.textContent = `${clock(t)} / ${clock(audio.duration || lesson.seconds)}`
  cancelAnimationFrame(session.raf)
  if (!audio.paused) session.raf = requestAnimationFrame(() => tick(session))
}

function jump(session, i) {
  const { lesson, audio } = session
  audio.currentTime = lesson.timing[Math.min(lesson.timing.length - 1, Math.max(0, i))].a
  audio.play().catch(() => {})
  tick(session)
}

function finish(session) {
  const { ctx, lesson, view } = session
  if (session.finished) return
  session.finished = true
  const outcome = ctx.state.finish(lesson, 1)
  ctx.audio.chime(4)
  view.body.replaceChildren(resultNode(lesson, outcome, {
    close: () => ctx.ui.closeModal(),
    drill: () => ctx.openPractice({ mode: 'cloze', lesson, title: `第 ${lesson.n} 课 · 练一练` }),
  }))
  view.bar.hidden = true
  ctx.onLesson(lesson)
}

function bind(session) {
  const { view, audio, lesson } = session
  const toggle = () => audio.paused ? audio.play().catch(() => {}) : audio.pause()
  session.onKey = event => {
    if (session.finished || event.metaKey || event.ctrlKey) return
    if (event.code === 'Space') { event.preventDefault(); toggle() }
    if (event.code === 'ArrowRight') jump(session, session.now + 1)
    if (event.code === 'ArrowLeft') jump(session, session.now - 1)
  }
  audio.addEventListener('play', () => { view.play.textContent = '❚❚'; view.play.setAttribute('aria-label', '暂停'); tick(session) })
  audio.addEventListener('pause', () => { view.play.textContent = '▶'; view.play.setAttribute('aria-label', '播放') })
  audio.addEventListener('timeupdate', () => tick(session))
  audio.addEventListener('ended', () => finish(session))
  view.play.addEventListener('click', toggle)
  view.text.addEventListener('click', event => { const node = event.target.closest('.s'); if (node && !getSelection()?.toString()) jump(session, Number(node.dataset.i)) })
  view.seek.addEventListener('click', event => { const box = view.seek.getBoundingClientRect(); audio.currentTime = (event.clientX - box.left) / box.width * (audio.duration || lesson.seconds); tick(session) })
  view.speed.addEventListener('click', () => { session.speed = (session.speed + 1) % SPEEDS.length; audio.playbackRate = SPEEDS[session.speed]; view.speed.textContent = `${SPEEDS[session.speed]}×` })
  view.zhToggle.addEventListener('click', () => { const on = view.zh.hidden; view.zh.hidden = !on; view.zhToggle.classList.toggle('is-on', on); view.zhToggle.setAttribute('aria-pressed', String(on)) })
  addEventListener('keydown', session.onKey)
}

export async function openReader(ctx, meta) {
  const lesson = await (await fetch(`data/lessons/${meta.id}.json`)).json()
  const audio = new Audio(`data/audio/${meta.id}.m4a`)
  const session = { ctx, lesson, audio, view: readerView(ctx, lesson), now: -1, word: -1, raf: 0, finished: false, speed: 0, onKey: null }
  bind(session)
  ctx.ui.openModal(session.view.root, () => { audio.pause(); cancelAnimationFrame(session.raf); removeEventListener('keydown', session.onKey) })
  return { audio, lesson }
}
