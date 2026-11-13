// 界面的几块公用地盘：右边的抽屉、盖住森林的大卡片、顶上的提示条
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

export const GENRES = { story: '故事', dialogue: '对话', talk: '分享', chat: '聊天', profile: '人物' }

export const stars = (count, max = 2) => h('span', { class: 'stars', 'aria-label': `${count} 颗星` }, ...Array.from({ length: max }, (_, k) => k < count ? h('i', {}, '★') : '☆'))

export function appCard(app) {
  return h('div', { class: 'appcard' },
    h('img', { src: app.icon, alt: '', width: 52, height: 52 }),
    h('div', {}, h('small', {}, '这个点子来自我做的 iPhone App'), h('strong', {}, app.zh === app.en ? app.zh : `${app.zh} ${app.en}`), h('span', {}, app.tagline)),
    h('a', { class: 'button', href: app.store, target: '_blank', rel: 'noopener' }, 'App Store'))
}

export function createUI(rig, audio) {
  const drawer = document.getElementById('drawer')
  const modal = document.getElementById('modal')
  const toasts = document.getElementById('toasts')
  let drawerClosed = null
  let modalClosed = null

  function closeDrawer() {
    if (drawer.hidden) return
    drawer.hidden = true
    rig.sideGoal = 0
    const done = drawerClosed
    drawerClosed = null
    done?.()
  }

  function openDrawer({ kicker, title, sub, body, app, onClose }) {
    closeDrawer()
    drawerClosed = onClose ?? null
    drawer.replaceChildren(...[
      h('header', { class: 'drawer-head' },
        h('div', { class: 'grow' }, kicker && h('p', { class: 'kicker' }, kicker), h('h2', {}, title), sub && h('p', {}, sub)),
        h('button', { class: 'close', type: 'button', 'aria-label': '关上', onclick: closeDrawer }, '✕')),
      h('div', { class: 'drawer-body' }, body),
      app && appCard(app)].filter(Boolean))
    drawer.hidden = false
    rig.sideGoal = innerWidth > 720 ? 6.5 : 0
    audio.pop()
  }

  function closeModal() {
    if (modal.hidden) return
    modal.hidden = true
    modal.replaceChildren()
    delete document.body.dataset.modal
    const done = modalClosed
    modalClosed = null
    done?.()
  }

  function openModal(node, onClose) {
    // 大卡片换内容（读完课文接着去练习）也算关了前一张：让它把声音、按键监听收干净
    const previous = modalClosed
    modalClosed = null
    previous?.()
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
    get busy() { return !modal.hidden },
    get drawerOpen() { return !drawer.hidden },
    /// Esc：先关大卡片，再关抽屉
    escape() { if (!modal.hidden) closeModal(); else closeDrawer() },
  }
}
