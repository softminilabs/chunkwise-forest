// 讲堂专题末尾的小测：选择题点了就判，别的题打字再检查。当场给对错和讲解，做完什么都不记。搬自网页版的 quiz-html.mjs、quiz.js
import { h } from './core.js'
import { t } from '../i18n.js'
import { markup } from './hall-doc.js'

/// 比对前抹掉不影响对错的差别：大小写、弯直引号、多余空格、句末标点
const normalize = text => String(text).toLowerCase()
  .replace(/[’‘`]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+([,.!?;:])/g, '$1').replace(/[.!?。！？]+$/, '')
  .replace(/\s+/g, ' ').trim()

function say(feedback, right, text) {
  feedback.innerHTML = `<strong>${right ? t('对了！') : t('不对。')}</strong>${markup(text)}`
  feedback.className = `quiz-feedback ${right ? 'is-right' : 'is-wrong'}`
  feedback.hidden = false
}

function choice(q) {
  const answer = typeof q.answer === 'number' ? q.answer : q.options.indexOf(q.answer)
  const feedback = h('p', { class: 'quiz-feedback', hidden: true })
  const pick = k => {
    options.forEach(option => option.classList.remove('is-right', 'is-wrong'))
    options[k].classList.add(k === answer ? 'is-right' : 'is-wrong')
    options[answer].classList.add('is-right')
    say(feedback, k === answer, q.explain)
  }
  const options = q.options.map((option, k) => h('button', { class: 'quiz-option', type: 'button', html: markup(option), onclick: () => pick(k) }))
  return h('div', { class: 'quiz-item' }, h('p', { class: 'quiz-prompt', html: markup(q.prompt) }), h('div', { class: 'quiz-options' }, options), feedback)
}

/// 填空、改错、改写、翻译：打字作答。写得和答案不一样但也对的说法在 accept 里，常见的错在 traps 里（各有一句为什么错）
function typed(q) {
  const accepted = [q.answer, ...q.accept ?? []].map(normalize)
  const field = h(q.type === 'translate' ? 'textarea' : 'input', { rows: q.type === 'translate' && 2, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': t('你的答案') })
  const feedback = h('p', { class: 'quiz-feedback', hidden: true })
  const answer = h('div', { class: 'quiz-answer', hidden: true }, h('p', { html: `${t('答案：')}<span lang="en">${markup(q.answer)}</span>` }), q.explain && h('p', { html: markup(q.explain) }))
  const check = () => {
    const value = normalize(field.value)
    if (!value) return
    const right = accepted.includes(value)
    say(feedback, right, right ? '' : q.traps?.find(trap => normalize(trap.input) === value)?.note)
    if (right) answer.hidden = false
  }
  field.addEventListener('keydown', event => {
    // 输入法还在选字时的回车是上屏，不是交卷
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    check()
  })
  return h('div', { class: 'quiz-item' },
    h('p', { class: 'quiz-prompt', html: markup(q.prompt) }),
    h('div', { class: 'quiz-row' }, field,
      h('button', { class: 'button', type: 'button', onclick: check }, t('检查')),
      h('button', { class: 'button plain', type: 'button', onclick: () => { answer.hidden = false } }, t('看答案'))),
    feedback, answer)
}

export const quizNode = q => q.type === 'choice' ? choice(q) : typed(q)
