// 界面语言。中文是原文，也是键：t('声音') 在英文下去 EN 表里查，查不到就原样用中文。
// 是哪种语言由 index.html 开头那段脚本在第一帧之前定好，写在 <html lang> 上，这里只读。
// 换语言是整页重载：界面是一次搭好的，文字都已经写进节点里了，重搭一遍最不容易漏
import { EN } from './i18n-en.js'

export const lang = document.documentElement.lang === 'en' ? 'en' : 'zh'

/// values 用来替换 {n} 这样的占位。英文表里的值也可以是函数，处理单复数
export function t(zh, values) {
  const text = lang === 'en' ? EN[zh] ?? zh : zh
  if (typeof text === 'function') return text(values)
  return values ? text.replace(/\{(\w+)\}/g, (_, key) => values[key]) : text
}

/// 数据里成对的字段（zh / en、tagline / taglineEn）按语言挑一个，英文缺了就用中文
export const pick = (item, zh = 'zh', en = 'en') => (lang === 'en' && item[en]) || item[zh]

export function setLang(next) {
  localStorage.setItem('cw.lang', next)
  location.reload()
}
