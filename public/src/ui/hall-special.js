// 讲堂里格式和别的专题不一样的三张表：不规则动词、名词单复数、介词 in / on / at。搬自网页版的 special.mjs。
// 每个函数返回 { lead, sections: [[标题, html]] }，和普通专题一样排进页面
import { t } from '../i18n.js'
import { chips, esc, list, markup, mistake, sound } from './hall-doc.js'

function irregularVerbs(data) {
  const patterns = Object.keys(data.patterns)
  const legend = `<ul class="pattern-legend">${patterns.map(key => `<li><strong>${esc(key)}</strong> ${esc(data.patterns[key])}</li>`).join('')}</ul>`
  const tools = `<div class="verb-tools"><input type="search" class="verb-search" placeholder="${esc(t('搜原形、过去式、中文'))}" aria-label="${esc(t('搜原形、过去式、中文'))}">
  <div class="verb-patterns" role="group" aria-label="${esc(t('按变化规律筛'))}"><button type="button" class="chip is-on" data-pattern="">${esc(t('全部'))}</button>${patterns.map(key => `<button type="button" class="chip" data-pattern="${esc(key)}">${esc(key)}</button>`).join('')}</div></div>`
  // 另一种写法（burnt、gotten）写在本来那个下面，说明跟在中文意思后面
  const form = (item, key) => `<td lang="en">${esc(item[key])}${item.alt?.[key] ? `<small>${esc(item.alt[key])}</small>` : ''}</td>`
  const note = item => [item.note, item.alt?.note].filter(Boolean).map(text => `<small>${esc(text)}</small>`).join('')
  const rows = data.items.map(item => `<tr data-pattern="${esc(item.pattern)}"><td lang="en">${esc(item.base)}</td>${form(item, 'past')}${form(item, 'pp')}<td>${esc(item.zh)}${note(item)}</td><td><span class="lv">${esc(item.level)}</span></td><td>${esc(item.pattern)}</td></tr>`).join('')
  const head = [...data.columns, '意思', '级别', '规律'].map(text => `<th>${esc(text)}</th>`).join('')
  return { sections: [['', `${legend}${tools}<div class="table-wrap"><table class="verbs"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`]] }
}

/// 不规则动词表上面的搜索和按规律筛
export function wireVerbs(root) {
  const table = root.querySelector('table.verbs')
  if (!table) return
  const search = root.querySelector('.verb-search')
  const filters = [...root.querySelectorAll('.verb-patterns button')]
  let pattern = ''
  const apply = () => {
    const query = search.value.trim().toLowerCase()
    for (const row of table.tBodies[0].rows) row.hidden = Boolean(pattern && row.dataset.pattern !== pattern) || Boolean(query && !row.textContent.toLowerCase().includes(query))
  }
  search.addEventListener('input', apply)
  for (const button of filters) button.addEventListener('click', () => {
    pattern = button.dataset.pattern
    for (const other of filters) other.classList.toggle('is-on', other === button)
    apply()
  })
}

const wordList = (items, render) => `<ul class="word-grid">${items.map(item => `<li>${render(item)}</li>`).join('')}</ul>`
const oneMany = item => `<span lang="en">${esc(item.one)} → <strong>${esc(item.many)}</strong></span><small>${esc(item.zh)}</small>`
const word = item => `<span lang="en">${esc(item.word)}</span><small>${esc(item.zh)}</small>`
const arrows = pairs => chips(pairs, ([one, many]) => `${esc(one)} → ${esc(many)}`)

function nounPlural(data) {
  const rule = item => `<li><p><strong>${markup(item.rule)}</strong> → ${markup(item.change)}</p>${arrows(item.examples)}${item.except ? `<p class="line-rule">例外</p>${arrows(item.except)}` : ''}${item.note ? `<p class="why">${markup(item.note)}</p>` : ''}</li>`
  const uncountable = item => `<tr><td lang="en">${esc(item.word)}</td><td>${esc(item.zh)}</td><td lang="en">${esc(item.howToCount)}</td><td lang="en">${markup(item.example)}</td><td lang="en">${item.wrong ? `<del class="wrong">${esc(item.wrong)}</del>` : ''}</td></tr>`
  return { lead: data.idea, sections: [
    ['变化规则', list(data.rules, rule, 'spell-rules')],
    ['-s 怎么读', `${list(data.sound, sound, 'sounds')}<p class="sec-note">${markup(data.specialSound)}</p>`],
    ['不规则变化', wordList(data.irregular, oneMany)],
    ['单复数一样', wordList(data.sameForm, word)],
    ['只有复数', wordList(data.pluralOnly, word)],
    ['外来词', wordList(data.foreign, oneMany)],
    ['复合名词', wordList(data.compound, oneMany)],
    ['不可数名词', `<div class="table-wrap"><table><thead><tr><th>词</th><th>意思</th><th>要数的时候</th><th>例子</th><th>别写成</th></tr></thead><tbody>${data.uncountable.map(uncountable).join('')}</tbody></table></div>`],
    ['可数时意思变了', list(data.countableWithNewMeaning, item => `<li><p class="line-rule"><span lang="en">${esc(item.word)}</span>：不可数是「${esc(item.uncountable)}」</p><span class="en" lang="en">${markup(item.countable)}</span><span class="zh">${esc(item.countableZh)}</span></li>`, 'lines')],
    ['主谓一致', list(data.agreement, item => `<li><p class="line-rule">${markup(item.rule)}</p><span class="en" lang="en">${markup(item.en)}</span></li>`, 'lines')],
    ['常见的错', list(data.commonMistakes, mistake, 'mistakes')],
  ] }
}

function prepositions(data) {
  const card = item => `<li><p class="prep" lang="en">${esc(item.prep)}</p><p class="line-rule">${markup(item.rule)}</p>${chips(item.items, esc)}
    <span class="en" lang="en">${markup(item.example)}</span>${item.note ? `<p class="why">${markup(item.note)}</p>` : ''}</li>`
  const kinds = [...new Set(data.categories.map(item => item.kind))]
  return { lead: data.idea, sections: kinds.map(kind => [kind, list(data.categories.filter(item => item.kind === kind), card, 'prep-cards')]) }
}

export const SPECIAL = { 'irregular-verbs.json': irregularVerbs, 'noun-plural.json': nounPlural, 'prepositions-in-on-at.json': prepositions }
