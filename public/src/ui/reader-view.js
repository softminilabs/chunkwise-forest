// 课文页长什么样：标题栏、文章、底下的播放条。这里只管搭出来，行为在 reader.js
import { GENRES, h } from './core.js'
import { t } from '../i18n.js'

export const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// 图标自己画：⏮ ▶ ⏭ 这些字符在苹果设备上会被换成彩色表情，和界面不搭
const ICONS = {
  play: '<path d="M8 5.2v13.6L19.5 12z"/>',
  pause: '<path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/>',
  prev: '<path d="M5.5 5H8v14H5.5zM19 5.5v13L9.5 12z"/>',
  next: '<path d="M16 5h2.5v14H16zM5 5.5v13l9.5-6.5z"/>',
  loop: '<path d="M17 2.5l3 3-3 3M4 11V9.5a4 4 0 014-4h12M7 21.5l-3-3 3-3M20 13v1.5a4 4 0 01-4 4H4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  cards: '<path d="M4 7h11v13H4zM8 4h12v13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
}
export const icon = name => h('span', { class: 'icon', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>` })

/// 一句话拆成一个个词（朗读时逐词点亮），组块和生词所在的那一段套上标记，点它能看解释
function sentenceNode(sentence, index, words, marks) {
  const node = h('span', { class: 's', 'data-i': index })
  const markOf = (from, to) => marks.find(mark => from >= mark.r[0] && to <= mark.r[1])
  const piece = (from, to, word) => {
    const mark = markOf(from, to)
    const text = sentence.en.slice(from, to)
    if (word == null && !mark) return text
    return h('span', { class: [word != null && 'w', mark && `m-${mark.kind}`].filter(Boolean).join(' '), 'data-w': word, 'data-card': mark?.id }, text)
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

/// 一段一块：对话课每段前面是说话人，每段后面跟着这一段的中文（「中文 全文」时显示）
function articleNode(lesson) {
  const root = h('div', { class: 'article', lang: 'en' })
  const names = [...new Set(lesson.sentences.map(sentence => sentence.speaker).filter(Boolean))]
  let paragraph = null
  lesson.sentences.forEach((sentence, i) => {
    if (!paragraph || sentence.p !== lesson.sentences[i - 1].p) {
      paragraph = h('p', { class: 'para' })
      const zh = lesson.sentences.filter(item => item.p === sentence.p).map(item => item.zh).join('')
      const who = sentence.speaker && h('p', { class: `speaker tone-${names.indexOf(sentence.speaker) % 4}` }, h('b', {}, sentence.speaker.slice(0, 1)), sentence.speaker)
      root.append(h('div', { class: 'turn' }, who, paragraph, h('p', { class: 'para-zh', lang: 'zh-CN' }, zh)))
    }
    paragraph.append(sentenceNode(sentence, i, lesson.timing[i].w, lesson.cards.filter(card => card.s === i)), ' ')
  })
  return root
}

function preNode(lesson) {
  if (!lesson.pre) return null
  return h('section', { class: 'pre' },
    h('p', { class: 'kicker' }, t('先猜一猜 · 听的时候找答案')),
    h('p', { class: 'pre-q', lang: 'en' }, lesson.pre.en),
    h('p', { class: 'pre-zh' }, lesson.pre.zh),
    h('div', { class: 'pre-options' }, lesson.pre.options.map((text, k) => h('button', { class: 'pre-option', type: 'button', lang: 'en', 'data-k': k }, text))))
}

/// 标题旁的小圆环：听过几句
function ringNode(total) {
  const LENGTH = 2 * Math.PI * 15
  const root = h('div', { class: 'ring', title: t('听过的句子'), html: `<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ring-fill" cx="18" cy="18" r="15" stroke-dasharray="${LENGTH}" stroke-dashoffset="${LENGTH}" transform="rotate(-90 18 18)"/></svg><span>0/${total}</span>` })
  return { root, set(count) { root.querySelector('.ring-fill').setAttribute('stroke-dashoffset', LENGTH * (1 - count / total)); root.querySelector('span').textContent = `${count}/${total}` } }
}

/// 一组互斥的小按钮（听法、中文）。options 是 [[id, 文字], …]，点亮哪个由 reader.js 定
const segment = (name, label, title, options) => h('div', { class: 'segment', role: 'group', 'aria-label': label, title }, options.map(([id, text]) => h('button', { type: 'button', [`data-${name}`]: id }, text)))

/// 播放条。上面一行进度，下面一行分三块：左边怎么听，中间播放（循环和语速贴着走带键），右边看不看中文
function barNode(lesson, modes, zh) {
  const bar = {
    fill: h('i', { class: 'seek-fill' }),
    thumb: h('i', { class: 'seek-thumb' }),
    ticks: lesson.timing.map(item => h('i', { class: 'tick', style: `left:${item.a / lesson.duration * 100}%` })),
    play: h('button', { class: 'play', type: 'button', 'aria-label': t('播放'), title: t('播放 / 暂停（空格）') }, icon('play')),
    prev: h('button', { class: 'round', type: 'button', 'aria-label': t('上一句'), title: t('上一句（←）') }, icon('prev')),
    next: h('button', { class: 'round', type: 'button', 'aria-label': t('下一句'), title: t('下一句（→）') }, icon('next')),
    time: h('span', { class: 'time' }, '0:00'),
    total: h('span', { class: 'time' }, clock(lesson.duration)),
    modes: segment('mode', t('听法'), t('换听法（M）'), Object.entries(modes)),
    zh: segment('zh', t('中文'), t('中文（Z）'), zh),
    loop: h('button', { class: 'chip', type: 'button', title: t('循环（L）') }),
    speed: h('button', { class: 'chip', type: 'button', title: t('语速（S）') }),
    cards: h('button', { class: 'chip only-narrow', type: 'button' }, icon('cards'), t('卡片 {n}', { n: lesson.cards.length })),
  }
  bar.seek = h('div', { class: 'seek', role: 'slider', 'aria-label': t('进度'), tabindex: 0 }, ...bar.ticks, bar.fill, bar.thumb)
  bar.root = h('footer', { class: 'reader-bar' },
    h('div', { class: 'seek-row' }, bar.time, bar.seek, bar.total),
    h('div', { class: 'controls' },
      bar.modes,
      h('div', { class: 'transport' }, bar.loop, bar.prev, bar.play, bar.next, bar.speed),
      h('div', { class: 'reader-opts' }, h('span', { class: 'seg-label' }, t('中文')), bar.zh, bar.cards)))
  return bar
}

export function buildReader(ctx, lesson, side, modes, zh) {
  const article = articleNode(lesson)
  const ring = ringNode(lesson.sentences.length)
  const bar = barNode(lesson, modes, zh)
  const view = { ...bar, bar: bar.root, article, ring, side, pre: preNode(lesson), sentences: [...article.querySelectorAll('.s')], line: h('p', { class: 'reader-line' }) }
  view.scroll = h('div', { class: 'reader-scroll' }, view.pre, lesson.intro && h('p', { class: 'intro' }, lesson.intro), article)
  view.main = h('div', { class: 'reader-main' }, h('div', { class: 'reader-page' }, view.scroll, view.line), side.root)
  view.root = h('section', { class: 'reader sticker', 'aria-label': lesson.title },
    h('header', { class: 'reader-head' },
      h('div', { class: 'grow' }, h('p', { class: 'kicker' }, t('单元 {unit} · 第 {n} 课 · {genre} · {min} 分钟', { unit: lesson.unit, n: lesson.n, genre: GENRES[lesson.genre] ?? lesson.genre, min: Math.max(1, Math.round(lesson.duration / 60)) })), h('h2', { lang: 'en' }, lesson.title)),
      ring.root, h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), title: t('回森林（Esc）'), onclick: () => ctx.ui.closeModal() }, '✕')),
    view.main, view.bar)
  return view
}
