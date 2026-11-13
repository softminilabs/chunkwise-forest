// 森林里能用的东西（木屋、篝火、宝箱）。每样东西头顶有个标签，但不是一直都在：
// 木屋和篝火是学习的地方，名字一直显示；宝箱这类 quiet 的，走到跟前、或者鼠标指上去才冒出来。
// 标签是普通的网页元素，字清楚、能点，触屏上点标签就等于点东西
import * as THREE from 'three'
import { t } from './i18n.js'

const QUIET_RANGE = 7.5

export function createThings(root, { onChoose }) {
  const list = []
  const spot = new THREE.Vector3()
  const sphere = new THREE.Sphere()
  let hovered = null

  /// 标签里的字。东西的名字会变（宝箱打开后换成 App 的名字），所以单拎出来
  function refresh(thing) {
    thing.tag.className = `tag tag-${thing.kind}`
    thing.tag.innerHTML = `${thing.icon ? `<img src="${thing.icon}" alt="">` : `<b>${thing.badge ?? ''}</b>`}<span class="tag-text"><strong>${thing.title}</strong><small>${thing.hint ?? ''}</small></span><kbd>${t('空格')}</kbd>`
  }

  function add(thing) {
    const tag = document.createElement('button')
    tag.type = 'button'
    tag.addEventListener('click', () => onChoose(entry))
    root.append(tag)
    const entry = { reach: 3.2, radius: 2, height: 3, ...thing, tag }
    refresh(entry)
    list.push(entry)
    return entry
  }

  /// 离得最近、够得着的那一个
  function nearest(position) {
    let best = null
    let bestGap = Infinity
    for (const thing of list) {
      const gap = Math.hypot(thing.position.x - position.x, thing.position.z - position.z)
      if (!thing.off && gap < thing.reach + 1.4 && gap < bestGap) { best = thing; bestGap = gap }
    }
    return best
  }

  function pick(ray) {
    let best = null
    let bestGap = Infinity
    for (const thing of list) {
      if (thing.off) continue
      sphere.center.set(thing.position.x, thing.position.y + thing.height * 0.5, thing.position.z)
      sphere.radius = Math.max(thing.radius, thing.height * 0.5)
      if (!ray.intersectsSphere(sphere)) continue
      const gap = ray.origin.distanceTo(sphere.center)
      if (gap < bestGap) { best = thing; bestGap = gap }
    }
    return best
  }

  // 顶上那排按钮盖住的地方不放牌子，不然牌子会从按钮缝里露出半截。按钮的位置一秒量一次就够
  let chrome = []
  let measuredAt = -1
  function covered(x, y, time) {
    if (time - measuredAt > 1) { measuredAt = time; chrome = [...document.querySelectorAll('.hud > *')].map(node => node.getBoundingClientRect()) }
    return chrome.some(box => x > box.left - 60 && x < box.right + 60 && y > box.top && y - 36 < box.bottom)
  }

  function update(camera, player, time, width, height) {
    const near = nearest(player)
    for (const thing of list) {
      spot.set(thing.position.x, thing.position.y + thing.height + 0.9 + Math.sin(time * 2 + thing.position.x) * 0.1, thing.position.z).project(camera)
      const gap = Math.hypot(thing.position.x - player.x, thing.position.z - player.z)
      const x = (spot.x + 1) / 2 * width
      const y = (1 - spot.y) / 2 * height
      const shown = !thing.off && spot.z < 1 && Math.abs(spot.x) < 1.1 && Math.abs(spot.y) < 1.1 && gap < 70 && !(thing.quiet && gap > QUIET_RANGE && thing !== hovered) && (thing === near || !covered(x, y, time))
      thing.tag.hidden = !shown
      thing.tag.classList.toggle('is-hover', thing === hovered)
      if (!shown) continue
      thing.tag.classList.toggle('is-near', thing === near)
      thing.tag.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      thing.tag.style.zIndex = String(Math.round((1 - spot.z) * 100000))
    }
    return near
  }

  return { list, add, refresh, nearest, pick, update, hover(ray) { hovered = ray ? pick(ray) : null; return Boolean(hovered) } }
}
