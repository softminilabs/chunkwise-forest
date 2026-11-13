// 界面的几块公用地盘：屏幕中间的小卡片（代码里沿用旧名 drawer，它原先是右边的抽屉）、读课文和练习的大卡片、顶上的提示条。
// 小卡片和大卡片出来的样子一样：一层压暗虚化的底，卡片在正中。区别是小卡片开着时森林照常走（调声音、换季节要当场看到听到）
import { lang, pick, t } from '../i18n.js'

export function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value == null || value === false) continue
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
    else if (key === 'class') node.className = value
    else if (key === 'html') node.innerHTML = value
    else node.setAttribute(key, value === true ? '' : value)
  }
  node.append(...children.flat().filter(child => child != null && child !== false))
  return node
}

export const GENRES = { story: t('故事'), dialogue: t('对话'), talk: t('分享'), chat: t('聊天'), profile: t('人物') }

export const stars = (count, max = 2) => h('span', { class: 'stars', 'aria-label': t('{n} 颗星', { n: count }) }, ...Array.from({ length: max }, (_, k) => k < count ? h('i', {}, '★') : '☆'))

/// 中文界面里中英文名都写，英文界面只写英文名
export const appName = app => lang === 'en' || app.zh === app.en ? pick(app) : `${app.zh} ${app.en}`

export function appCard(app) {
  return h('div', { class: 'appcard' },
    h('img', { src: app.icon, alt: '', width: 52, height: 52 }),
    h('div', {}, h('strong', {}, appName(app)), h('span', {}, pick(app, 'tagline', 'taglineEn'))),
    h('a', { class: 'button', href: app.store, target: '_blank', rel: 'noopener' }, 'App Store'))
}

export function createUI(audio) {
  const drawer = document.getElementById('drawer')
  // 小卡片底下那层压暗虚化的底，卡片在它里面
  const sheet = document.getElementById('sheet')
  const modal = document.getElementById('modal')
  const toasts = document.getElementById('toasts')
  let drawerClosed = null
  let modalClosed = null
  // 小卡片正在淡出时的那段动画；淡完才真正收起来
  let fading = null
  let modalFading = null
  sheet.addEventListener('click', event => { if (event.target === sheet) closeDrawer() })

  function closeDrawer() {
    if (sheet.hidden || fading) return
    fading = sheet.animate({ opacity: [1, 0] }, { duration: 200, easing: 'ease-in' })
    fading.onfinish = () => { sheet.hidden = true; fading = null }
    const done = drawerClosed
    drawerClosed = null
    done?.()
  }

  function openDrawer({ kicker, title, sub, body, app, onClose }) {
    closeDrawer()
    // 上一张还在淡出就又开了一张：不等它淡完，直接换内容
    fading?.cancel()
    fading = null
    drawerClosed = onClose ?? null
    drawer.replaceChildren(...[
      h('header', { class: 'drawer-head' },
        h('div', { class: 'grow' }, kicker && h('p', { class: 'kicker' }, kicker), h('h2', {}, title), sub && h('p', {}, sub)),
        h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: closeDrawer }, '✕')),
      h('div', { class: 'drawer-body' }, body),
      app && appCard(app)].filter(Boolean))
    // 出来的动效写在样式里（和大卡片同一套），从隐藏变成显示的那一下自己会播
    sheet.hidden = false
    audio.pop()
  }

  function closeModal() {
    if (modal.hidden || modalFading) return
    delete document.body.dataset.modal
    const done = modalClosed
    modalClosed = null
    done?.()
    // 和小卡片一样：淡出去再收起来，不是啪地一下没了
    modalFading = modal.animate({ opacity: [1, 0] }, { duration: 200, easing: 'ease-in' })
    modalFading.onfinish = () => { modal.hidden = true; modal.replaceChildren(); modalFading = null }
  }

  function openModal(node, onClose) {
    // 大卡片换内容（读完课文接着去练习）也算关了前一张：让它把声音、按键监听收干净
    const previous = modalClosed
    modalClosed = null
    previous?.()
    // 上一张还在淡出就又开了一张（练习场里点「去读一课」）：不等它淡完
    modalFading?.cancel()
    modalFading = null
    modalClosed = onClose ?? null
    modal.replaceChildren(node)
    modal.hidden = false
    document.body.dataset.modal = 'open'
  }

  function toast(html) {
    const node = h('div', { class: 'toast', html })
    toasts.append(node)
    setTimeout(() => node.remove(), 3100)
  }

  return {
    openDrawer, closeDrawer, openModal, closeModal, toast,
    get busy() { return !modal.hidden && !modalFading },
    get drawerOpen() { return !sheet.hidden && !fading },
    /// Esc：先关大卡片，再关小卡片
    escape() { if (!modal.hidden && !modalFading) closeModal(); else closeDrawer() },
  }
}
