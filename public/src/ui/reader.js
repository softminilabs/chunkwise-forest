// 读课文。朗读到哪句、哪个词，哪里就亮；点一句从那句读。
// 三种听法：看着听、盲听（没听过的句子先糊着）、跟读（每句读完停下来，等你照着念）。听完整篇才算读完，门口那盏灯才亮
import { h, stars } from './core.js'
import { buildSide } from './reader-side.js'
import { buildReader, clock, icon } from './reader-view.js'
import { LESSON_DROPS } from '../garden.js'
import { t } from '../i18n.js'

// 课文录音平均每分钟 163 个词，App 的 PRD 给 B1 定的是 140：慢的那一档取 0.85 倍，正好落在 140 上下
const SPEEDS = [1, 0.85, 1.2]
const MODES = { read: t('看着听'), blind: t('盲听'), shadow: t('跟读') }
const LOOPS = ['off', 'one', 'all']

/// 一句算读到哪儿为止。时间轴里有的句子结束得比下一句开始还晚几十毫秒，照着结束时间等就永远等不到：取两者里早的那个
const endOf = (lesson, i) => Math.min(lesson.timing[i].b, lesson.timing[i + 1]?.a ?? Infinity)

/// 读到第 i 句：亮起来、右边对应的卡片亮起来、滚到看得见的地方
function show(session, i) {
  const { view } = session
  if (i === session.now) return
  view.sentences[session.now]?.classList.remove('is-now')
  view.sentences[session.now]?.querySelector('.w.is-now')?.classList.remove('is-now')
  session.now = i
  session.word = -1
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
}

/// 一句读到头了。返回 true 表示已经停下来等跟读，这一帧不用再往下画
function sentenceEnd(session, i) {
  markHeard(session, i)
  // 补听：录音已经走到过头，只差几句没听。最后一句没听的补上了，当场算读完，不用再走到末尾
  if (session.catchUp && session.loop === 'off' && session.heard.size === session.lesson.sentences.length) { finish(session); return true }
  if (session.loop === 'one') { session.audio.currentTime = session.lesson.timing[i].a; session.ended = -1; return false }
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
  const total = audio.duration || lesson.duration
  const part = Math.min(1, t / total)
  view.fill.style.width = `${part * 100}%`
  view.thumb.style.left = `${part * 100}%`
  view.time.textContent = clock(t)
  view.total.textContent = clock(total)
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
  // 网页切到后台时这里一秒才来一两次，短句子会整句漏过去：一路连着放过来的，中间那几句也算听过
  // （拖进度条、点别的句子都会先把 playing 改掉，不会走到这儿）
  if (!audio.paused && playing >= 0) for (let k = playing + 1; k < i; k++) markHeard(session, k)
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
}

/// 中文译文开或关：开着时每段英文下面跟着这一段的中文
function setZh(session, on) {
  session.zh = on
  session.view.zh.setAttribute('aria-pressed', String(on))
  session.view.root.dataset.zh = on ? 'all' : 'off'
}

/// 单句循环、整篇循环各一个按钮，只能亮一个，都不亮就是不循环。
/// 试过并成一个按钮轮着换，默认显示「不循环」，结果看上去像单句循环没了
function setLoop(session, loop) {
  session.loop = loop
  session.view.loopOne.setAttribute('aria-pressed', String(loop === 'one'))
  session.view.loopAll.setAttribute('aria-pressed', String(loop === 'all'))
}

function setSpeed(session, k) {
  session.speed = k % SPEEDS.length
  session.audio.playbackRate = SPEEDS[session.speed]
  session.view.speed.textContent = t('语速 {x}×', { x: SPEEDS[session.speed] })
}

function guessLine(session) {
  const { pre } = session.lesson
  if (!pre) return null
  const lead = session.picked == null ? t('开头那道题的答案：') : session.picked === pre.answer ? t('开头那道题你猜对了：') : t('开头那道题，答案其实是：')
  return h('p', { class: 'note' }, lead, h('b', { lang: 'en' }, pre.options[pre.answer]))
}

function resultNode(session, outcome) {
  const { ctx, lesson } = session
  const index = ctx.state.lessons.findIndex(item => item.id === lesson.id)
  const next = ctx.state.lessons[index + 1]
  const count = outcome.fresh.length
  return h('div', { class: 'result' },
    h('p', { class: 'kicker' }, t('听完了')),
    h('h2', {}, `${t('第 {n} 课的灯亮了', { n: lesson.n })} `, stars(ctx.state.stars(lesson.id))),
    guessLine(session),
    h('p', { class: 'note' }, count ? t('收下 {n} 张新卡片，练习场里可以玩了：', { n: count }) : t('这一课的卡片你都收过了。')),
    h('div', { class: 'cards' }, outcome.fresh.map((card, k) => h('div', { class: `card card-${card.kind}`, style: `animation-delay:${k * 60}ms` }, h('strong', {}, card.text), h('small', {}, card.zh)))),
    h('div', { class: 'row center' },
      h('button', { class: 'button big', type: 'button', onclick: () => ctx.openPractice({ mode: 'cloze', lesson, title: t('第 {n} 课 · 练一练', { n: lesson.n }) }) }, t('练一练，再拿一颗星')),
      next && h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openLesson(next) }, t('下一课：{title}', { title: next.title })),
      h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openLesson(ctx.state.lessons[index]) }, t('再听一遍')),
      h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.ui.closeModal() }, t('回森林'))))
}

/// 整篇听完了：亮灯、收卡片。只算一次——整篇循环时每一遍都会走到这儿，
/// 而且第一遍收了哪些新卡片要留着，等最后出结果页时给人看
function complete(session) {
  const { ctx, lesson } = session
  if (session.outcome) return
  session.outcome = ctx.state.finish(lesson, 1)
  // 重听的也给：和「今天读了一课」一个规矩，每听完一遍都算
  ctx.garden.earn(LESSON_DROPS)
  ctx.audio.chime(4)
  ctx.onLesson(lesson)
}

function finish(session) {
  const { view } = session
  if (session.finished) return
  session.finished = true
  cancelWait(session)
  session.audio.pause()
  complete(session)
  view.main.replaceChildren(resultNode(session, session.outcome))
  view.root.append(session.ctx.water.prize(LESSON_DROPS, t('第 {n} 课听完了', { n: session.lesson.n })))
  view.bar.hidden = true
}

/// 录音放到头了。亮不亮灯看的是每一句有没有真听过，不看录音走没走到头：
/// 不然把进度条拖到末尾听最后一句，灯就亮了、卡片也收了。
/// 单句循环：最后一句照样循环；整篇循环：从头再来，每一句都听过了才记完成
function ended(session) {
  const { ctx, lesson, audio } = session
  const last = lesson.timing.length - 1
  if (session.loop === 'one') return jump(session, last)
  // 尾音放完时最后一句也算听过（按帧检查的那边可能还没来得及记）
  if (session.playing === last) markHeard(session, last)
  const missing = lesson.sentences.findIndex((_, i) => !session.heard.has(i))
  if (missing < 0 && session.loop === 'off') return finish(session)
  if (missing < 0) complete(session)
  if (session.loop === 'all') return jump(session, 0)
  // 还有没听的：停到第一句没听的那儿，等人接着听
  session.catchUp = true
  ctx.ui.toast(t('还有 {n} 句没听，听完整篇灯才亮', { n: lesson.sentences.length - session.heard.size }))
  session.playing = -1
  audio.currentTime = lesson.timing[missing].a
  tick(session)
}

/// 进度条：点和拖都行
function bindSeek(session) {
  const { view, audio, lesson } = session
  const move = event => {
    const box = view.seek.getBoundingClientRect()
    cancelWait(session)
    audio.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * (audio.duration || lesson.duration)
    // 拖走不等于「刚才那句读完了」：不清掉的话，单句循环会把人弹回原来那句，跟读会停下来等
    session.playing = -1
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
  KeyL: session => setLoop(session, LOOPS[(LOOPS.indexOf(session.loop) + 1) % LOOPS.length]),
  KeyZ: session => setZh(session, !session.zh),
  KeyS: session => setSpeed(session, session.speed + 1),
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
  // speaking：录音正在放。森林的环境声看它，放的时候全关，停下来才回来一点（main.js）
  audio.addEventListener('play', () => { session.ctx.speaking = true; view.play.replaceChildren(icon('pause')); view.play.setAttribute('aria-label', t('暂停')); tick(session) })
  audio.addEventListener('pause', () => { session.ctx.speaking = false; view.play.replaceChildren(icon('play')); view.play.setAttribute('aria-label', t('播放')) })
  audio.addEventListener('timeupdate', () => tick(session))
  audio.addEventListener('ended', () => ended(session))
  view.play.addEventListener('click', () => toggle(session))
  view.prev.addEventListener('click', () => jump(session, session.now - 1))
  view.next.addEventListener('click', () => jump(session, session.now + 1))
  view.modes.addEventListener('click', event => { const button = event.target.closest('[data-mode]'); if (button) setMode(session, button.dataset.mode) })
  // 再点一下亮着的那个就是关掉
  view.loopOne.addEventListener('click', () => setLoop(session, session.loop === 'one' ? 'off' : 'one'))
  view.loopAll.addEventListener('click', () => setLoop(session, session.loop === 'all' ? 'off' : 'all'))
  view.speed.addEventListener('click', () => setSpeed(session, session.speed + 1))
  view.zh.addEventListener('click', () => setZh(session, !session.zh))
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
  const session = { ctx, lesson, audio, mode: 'read', loop: 'off', zh: false, speed: 0, outcome: null, now: -1, word: -1, playing: -1, ended: -1, heard: new Set(), waiting: 0, raf: 0, finished: false, catchUp: false, picked: null, dragging: false, onKey: null }
  session.view = buildReader(ctx, lesson, buildSide(ctx, lesson, i => jump(session, i)), MODES)
  bind(session)
  setMode(session, session.mode)
  setLoop(session, 'off')
  setSpeed(session, 0)
  setZh(session, false)
  ctx.ui.openModal(session.view.root, () => { audio.pause(); cancelAnimationFrame(session.raf); clearTimeout(session.waiting); removeEventListener('keydown', session.onKey) })
  return { audio, lesson }
}
