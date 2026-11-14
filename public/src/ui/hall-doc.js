// 讲堂里一个专题的讲解：文字里的标记，和一节一节的内容。搬自网页版的 markup.mjs、sections.mjs，改成在浏览器里现画。
// 讲解本身不翻译；表头、「信号词」这类框架上的字走 t()，英文界面下是英文（和 App 一个做法）
import { t } from '../i18n.js'

export const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// [[x]] 重点形式  {x} 变化的部分（只在 [[ ]] 里）  ((x)) 变回原形的动词  <<x>> 信号词  ~~x~~ 错的部分  **x** 加粗
// 先转义再替换：内容里出现 < > 不会被当成标签
export function markup(text) {
  if (text == null) return ''
  return esc(text)
    .replace(/\[\[(.+?)\]\]/g, (_, inner) => `<mark class="key">${inner.replace(/\{(.+?)\}/g, '<b class="change">$1</b>')}</mark>`)
    .replace(/\(\((.+?)\)\)/g, '<span class="base">$1</span>')
    .replace(/&lt;&lt;(.+?)&gt;&gt;/g, '<span class="signal">$1</span>')
    .replace(/~~(.+?)~~/g, '<del class="wrong">$1</del>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export const list = (items, render, cls) => items?.length ? `<ul class="${cls}">${items.map(render).join('')}</ul>` : ''
export const chips = (items, render = markup) => `<p class="chips" lang="en">${items.map(item => `<span>${render(item)}</span>`).join('')}</p>`
const pair = (en, zh) => `<span class="en" lang="en">${markup(en)}</span>${zh ? `<span class="zh">${markup(zh)}</span>` : ''}`
const line = item => `<li>${item.rule ? `<p class="line-rule">${markup(item.rule)}</p>` : ''}${pair(item.en, item.zh)}${item.answer ? `<span class="answer">${markup(item.answer)}</span>` : ''}</li>`
export const mistake = item => `<li><p class="bad" lang="en">${markup(item.bad)}</p><p class="good" lang="en">${markup(item.good)}</p>${item.why ? `<p class="why">${markup(item.why)}</p>` : ''}</li>`
export const sound = item => `<li><p><strong class="ipa">${esc(item.say)}</strong> ${markup(item.when)}</p>${chips(item.examples)}</li>`

function table(rows) {
  const head = [t('人称'), t('肯定'), t('否定'), t('完整否定'), t('疑问'), t('简短回答')]
  const keys = ['who', 'pos', 'neg', 'negFull', 'q', 'short']
  return `<div class="table-wrap"><table class="conj"><thead><tr>${head.map(text => `<th>${text}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(row => `<tr>${keys.map(key => `<td lang="en">${markup(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}

// 一节里有哪些字段就画哪些，画的先后就是这里写的先后
const RENDER = {
  text: value => `<p class="sec-text">${markup(value)}</p>`,
  rule: value => `<p class="sec-rule">${markup(value)}</p>`,
  formula: value => `<p class="formula">${value.map(part => `<span>${markup(part)}</span>`).join('<i>+</i>')}</p>`,
  signals: value => `<p class="signals"><small>${esc(t('信号词'))}</small>${value.map(word => `<span class="signal" lang="en">${esc(word)}</span>`).join('')}</p>`,
  uses: value => list(value, use => `<li><p class="use-zh">${markup(use.zh)}</p>${pair(use.en, use.en_zh)}</li>`, 'uses'),
  rules: value => list(value, rule => `<li><p><strong>${markup(rule.ending)}</strong> → ${markup(rule.change)}</p>${chips(rule.examples)}</li>`, 'spell-rules'),
  items: value => list(value, line, 'lines'),
  examples: value => list(value, line, 'lines'),
  verb: value => `<p class="verb-label" lang="en">${esc(value)}</p>`,
  rows: table,
  // be 有的节是一张变位表，有的只是一句提醒（be 动词怎么跟着主语变）
  be: value => Array.isArray(value) ? table(value) : `<p class="sec-tip">${markup(value)}</p>`,
  contractions: value => chips(value),
  sound: value => list(value, sound, 'sounds'),
  oddSounds: value => `<p class="sec-note">${markup(value)}</p>`,
  pairs: value => list(value, item => `<li class="pair"><p class="pair-with">${markup(item.with)}</p>
    <div><p class="pair-meaning">${markup(item.this.meaning)}</p>${pair(item.this.en)}</div>
    <div><p class="pair-meaning">${markup(item.that.meaning)}</p>${pair(item.that.en)}</div></li>`, 'pairs'),
  // 一节里的 wrong 只有一组（不是数组）。网页版把它当数组画，结果一直没画出来
  wrong: value => list([value], mistake, 'mistakes'),
  commonMistakes: value => `<h4>${esc(t('常见的错'))}</h4>${list(value, mistake, 'mistakes')}`,
  notes: value => list(value, note => `<li>${markup(note)}</li>`, 'sec-notes'),
  tip: value => `<p class="sec-tip">${markup(value)}</p>`,
}

/// 一节：标题前面带序号（1 · 一句话说清），和正文顶上那一排对得上。没有标题的（整页只有一张表）不画标题
export const section = (number, title, html) => `<section class="sec">${title ? `<h3><span class="no">${number} ·</span>${markup(title)}</h3>` : ''}${html}</section>`

/// 一节的内容。title、short 不在这里画：一个是这一节的标题，一个是顶上那一排用的短名
export function sectionBody(data) {
  const unknown = Object.keys(data).filter(key => !RENDER[key] && key !== 'title' && key !== 'short')
  if (unknown.length) console.warn(`讲堂：「${data.title}」这一节有没画的字段 ${unknown.join('、')}`)
  return Object.keys(RENDER).filter(key => data[key] != null).map(key => RENDER[key](data[key])).join('')
}
