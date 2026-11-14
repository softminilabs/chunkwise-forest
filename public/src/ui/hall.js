// 讲堂：看语法、词形表、速查表的一张大卡片。左边是能开合的目录，右边直接是选中那个专题的讲解和小测，不跳到别的页面。
// 这里什么都不记：没有水滴、没有进度，目录开着哪几支也不记，每次打开都从头一个专题开始
import { h } from './core.js'
import { lang, pick, t } from '../i18n.js'
import { markup, section, sectionBody } from './hall-doc.js'
import { quizNode } from './hall-quiz.js'
import { SPECIAL, wireVerbs } from './hall-special.js'

const KINDS = { grammar: t('语法'), forms: t('词形表'), cheatsheets: t('速查表') }

// 取过的 json 留在内存里：再点回同一个专题、再开一次讲堂都不用重新取
const cache = new Map()
async function load(path) {
  if (!cache.has(path)) cache.set(path, await (await fetch(`data/library/${path}`)).json())
  return cache.get(path)
}

const nameOf = topic => pick(topic, 'title', 'en')

/// 窄屏上左边那一栏是盖在正文上面的一层，「目录」按钮开关它
function showNav(view, on) {
  view.root.classList.toggle('is-nav', on)
  view.menu.setAttribute('aria-pressed', String(on))
}

function setFold(fold, open) {
  fold.classList.toggle('is-open', open)
  fold.firstChild.setAttribute('aria-expanded', String(open))
}

/// 目录里能开合的一支：一整行标题都能点，后面跟着里面有几个专题
function foldNode(title, count, items) {
  const fold = h('div', { class: 'hall-fold' },
    h('button', { class: 'hall-fold-head', type: 'button', 'aria-expanded': 'false', onclick: () => setFold(fold, !fold.classList.contains('is-open')) }, title, h('small', {}, count)),
    // 多包一层：外面那层的行高从 0 过渡到内容那么高，里面这层把还没露出来的裁掉
    h('div', { class: 'hall-fold-body' }, h('div', {}, items)))
  return fold
}

/// 三大块各一支。语法底下还分六组，一组一支；词形表、速查表各只有五六个专题，直接列
function navNodes(view) {
  const button = topic => h('button', { class: 'hall-topic', type: 'button', 'data-id': topic.id, onclick: () => select(view, topic) }, nameOf(topic))
  const branch = (title, topics) => foldNode(title, topics.length, topics.map(button))
  return Object.entries(KINDS).map(([kind, title]) => {
    const own = view.topics.filter(topic => topic.kind === kind)
    const groups = [...new Set(own.map(topic => topic.group))]
    return groups.length === 1 ? branch(title, own) : foldNode(title, own.length, groups.map(group => branch(t(group), own.filter(topic => topic.group === group))))
  })
}

/// 左边选中的那一项。它在哪一支里，那一支就展开、标题变色；别的支开着合着都不动
function mark(view, topic) {
  for (const button of view.list.querySelectorAll('.hall-topic')) {
    const on = button.dataset.id === topic.id
    button.classList.toggle('is-on', on)
    button.setAttribute('aria-current', String(on))
  }
  const now = view.list.querySelector('.hall-topic.is-on')
  for (const fold of view.list.querySelectorAll('.hall-fold')) {
    fold.classList.toggle('has-on', fold.contains(now))
    if (fold.contains(now)) setFold(fold, true)
  }
  // 从「相关」跳过来时它可能不在看得见的地方：滚到中间。要等展开的过渡走完，位置才量得准。不用 scrollIntoView：它会连卡片一起滚
  setTimeout(() => {
    const [box, frame] = [now, view.list].map(node => node.getBoundingClientRect())
    if (box.bottom < frame.top || box.top > frame.bottom) view.list.scrollTop += box.top - frame.top - frame.height / 2
  }, 260)
}

/// 标题后面：中文界面写英文名，再跟级别
function titleNodes(topic, data) {
  const en = lang === 'zh' && topic.en
  return [h('h2', {}, nameOf(topic)), (en || data.level) && h('p', { class: 'hall-en' }, en && h('span', { lang: 'en' }, en), data.level && h('span', { class: 'lv' }, data.level))]
}

/// 小测后面的两块：用起来、相关
function tailNodes(view, data) {
  const related = (data.related ?? []).map(id => view.topics.find(other => other.id === id)).filter(Boolean)
  return [
    data.openTask && h('section', { class: 'sec' }, h('h3', {}, t('用起来')),
      h('p', { class: 'task', html: markup(data.openTask.prompt) }),
      h('ul', { class: 'sec-notes' }, data.openTask.rules.map(rule => h('li', { html: markup(rule) })))),
    related.length && h('section', { class: 'sec' }, h('h3', {}, t('相关')),
      h('div', { class: 'row' }, related.map(other => h('button', { class: 'chip', type: 'button', onclick: () => select(view, other) }, nameOf(other))))),
  ].filter(Boolean)
}

/// 一个专题的正文，外加顶上那一排要用的 [名字, 那一节的节点]
function pageNode(view, topic, data) {
  const special = SPECIAL[topic.file]?.(data)
  // 每一节：[标题, 内容, 顶上那一排用的短名]
  const parts = special ? special.sections : Object.values(data.sections).map(item => [item.title, sectionBody(item), item.short])
  const lead = special ? special.lead : data.summary
  // 英文界面下讲解仍是中文：标出来，汉字才不会被排成别的语言的字形
  const page = h('article', { class: 'hall-doc', lang: 'zh-CN', html: `${lead ? `<p class="lead">${markup(lead)}</p>` : ''}${parts.map(([title, body], k) => section(k + 1, title, body)).join('')}` })
  wireVerbs(page)
  const nodes = page.querySelectorAll('.sec')
  // 没有标题的那一节（整页只有一张表）不进顶上那一排
  const stops = parts.map(([title, , short], k) => [`${k + 1} ${short ?? title}`, nodes[k]]).filter((stop, k) => parts[k][0])
  if (data.quiz?.length) {
    const quiz = h('section', { class: 'sec' }, h('h3', {}, t('小测')), h('div', { class: 'quiz' }, data.quiz.map(quizNode)))
    page.append(quiz)
    stops.push([t('小测'), quiz])
  }
  page.append(...tailNodes(view, data))
  return { page, stops }
}

/// 顶上那一排里选中第 k 个；它不在那一排看得见的地方时，把它挪到中间
function setStop(view, k) {
  if (k === view.stop) return
  view.stop = k
  const tabs = [...view.tabs.children]
  tabs.forEach((tab, i) => tab.classList.toggle('is-on', i === k))
  view.tabs.scrollTo({ left: tabs[k].offsetLeft - (view.tabs.clientWidth - tabs[k].offsetWidth) / 2, behavior: 'smooth' })
}

/// 点顶上那一排里的一个：正文滚到那一节。只滚正文这一块（scrollIntoView 会连卡片一起滚）
function jump(view, k) {
  // 滚过去的路上、还有末尾几节短得到不了顶上的时候，按位置算出来的不是点的这一个：先认点的，等人自己动手滚了再按位置算
  view.held = true
  setStop(view, k)
  view.scroll.scrollTo({ top: view.scroll.scrollTop + view.stops[k].getBoundingClientRect().top - view.scroll.getBoundingClientRect().top - 12, behavior: 'smooth' })
}

/// 正文滚到哪一节，顶上那一排里哪个就是选中的
function spy(view) {
  if (view.held || !view.stops.length) return
  const { scrollTop, clientHeight, scrollHeight } = view.scroll
  const line = view.scroll.getBoundingClientRect().top + 80
  // 滚到底了就算最后一个：最后一节太短的话，它的标题到不了顶上
  setStop(view, scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2 ? view.stops.length - 1 : Math.max(0, view.stops.findLastIndex(node => node.getBoundingClientRect().top <= line)))
}

/// 换专题：右边的标题、那一排小节和正文先淡出，换好内容再淡入，回到第一节
async function select(view, topic) {
  showNav(view, false)
  if (view.topic === topic) return
  view.topic = topic
  mark(view, topic)
  const parts = [view.title, view.tabs, view.scroll]
  // 只写终点：上一个专题还没淡完又点了一个时，从当时的透明度接着淡，不会闪回来
  const gone = parts.map(part => part.animate({ opacity: 0 }, { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished)
  const [data] = await Promise.all([load(`${topic.kind}/${topic.file}`), ...gone])
  // 等的工夫里又点了别的：这一个不画了
  if (view.topic !== topic) return
  const { page, stops } = pageNode(view, topic, data)
  view.stops = stops.map(([, node]) => node)
  view.stop = 0
  view.held = false
  view.title.replaceChildren(...titleNodes(topic, data).filter(Boolean))
  view.tabs.replaceChildren(...stops.map(([name], k) => h('button', { class: k ? 'chip' : 'chip is-on', type: 'button', onclick: () => jump(view, k) }, name)))
  view.tabs.hidden = !stops.length
  view.scroll.replaceChildren(page)
  view.scroll.scrollTop = view.tabs.scrollLeft = 0
  for (const part of parts) {
    part.getAnimations().forEach(animation => animation.cancel())
    part.animate({ opacity: [0, 1] }, { duration: 300, easing: 'ease-out' })
  }
}

function build(view, ctx) {
  view.list = h('div', { class: 'hall-list' })
  view.title = h('div', { class: 'grow' })
  view.tabs = h('div', { class: 'hall-tabs' })
  view.scroll = h('div', { class: 'hall-scroll' })
  view.menu = h('button', { class: 'chip only-narrow', type: 'button', 'aria-pressed': 'false', onclick: () => showNav(view, !view.root.classList.contains('is-nav')) }, t('目录'))
  view.root = h('section', { class: 'hall sticker', 'aria-label': t('讲堂') },
    h('nav', { class: 'hall-nav', 'aria-label': t('目录') }, h('h2', {}, t('讲堂')), view.list),
    h('header', { class: 'hall-head' }, view.menu, view.title, h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
    view.tabs, view.scroll)
  view.scroll.addEventListener('scroll', () => spy(view), { passive: true })
  for (const kind of ['wheel', 'touchstart', 'pointerdown', 'keydown']) view.scroll.addEventListener(kind, () => { view.held = false }, { passive: true })
  // 鼠标滚轮只有竖向：在那一排小节上滚，就当横着滚
  view.tabs.addEventListener('wheel', event => { if (!event.deltaX) { view.tabs.scrollLeft += event.deltaY; event.preventDefault() } }, { passive: false })
  // 光标在答题的输入框里时，全局的 Esc 不管（controls.js 里打字时一律放行），这里补上
  view.root.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.isComposing && event.target.matches('input, textarea')) ctx.ui.closeModal() })
}

export async function openHall(ctx) {
  const view = { topic: null, stops: [], stop: 0, held: false }
  build(view, ctx)
  ctx.ui.openModal(view.root)
  view.topics = [...await load('index.json')].sort((a, b) => a.order - b.order)
  view.list.append(...navNodes(view))
  select(view, view.topics[0])
}
