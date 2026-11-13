// 小镇里能用的东西（房子、我的 App 变成的物件）。每样东西头顶有个标签，但不是一直都在：
// 二十多个标签全飘着，画面就被盖满了。远处只留房子的数字，App 的图标走到附近才冒出来，走到跟前才展开名字和按键提示。
// 标签是普通的网页元素，字清楚、能点，触屏上点标签就等于点东西
import * as THREE from 'three'

const ICON_RANGE = 15
const NAME_RANGE = 13

export function createThings(root, { onChoose }) {
  const list = []
  const spot = new THREE.Vector3()
  const sphere = new THREE.Sphere()

  function add(thing) {
    const tag = document.createElement('button')
    tag.type = 'button'
    tag.className = `tag tag-${thing.kind}`
    tag.innerHTML = `${thing.icon ? `<img src="${thing.icon}" alt="">` : `<b>${thing.badge ?? ''}</b>`}<span class="tag-text"><strong>${thing.title}</strong><small>${thing.hint ?? ''}</small></span><kbd>空格</kbd>`
    tag.addEventListener('click', () => onChoose(thing))
    root.append(tag)
    list.push({ reach: 3.2, radius: 2, height: 3, ...thing, tag })
    return list.at(-1)
  }

  /// 离得最近、够得着的那一个
  function nearest(position) {
    let best = null
    let bestGap = Infinity
    for (const thing of list) {
      const gap = Math.hypot(thing.position.x - position.x, thing.position.z - position.z)
      if (gap < thing.reach + 1.4 && gap < bestGap) { best = thing; bestGap = gap }
    }
    return best
  }

  function pick(ray) {
    let best = null
    let bestGap = Infinity
    for (const thing of list) {
      sphere.center.set(thing.position.x, thing.height * 0.5, thing.position.z)
      sphere.radius = Math.max(thing.radius, thing.height * 0.5)
      if (!ray.intersectsSphere(sphere)) continue
      const gap = ray.origin.distanceTo(sphere.center)
      if (gap < bestGap) { best = thing; bestGap = gap }
    }
    return best
  }

  function update(camera, player, time, width, height) {
    const near = nearest(player)
    for (const thing of list) {
      spot.set(thing.position.x, thing.height + 0.9 + Math.sin(time * 2 + thing.position.x) * 0.12, thing.position.z).project(camera)
      const gap = Math.hypot(thing.position.x - player.x, thing.position.z - player.z)
      const shown = spot.z < 1 && Math.abs(spot.x) < 1.1 && Math.abs(spot.y) < 1.1 && !(thing.kind === 'app' && gap > ICON_RANGE)
      thing.tag.hidden = !shown
      if (!shown) continue
      thing.tag.classList.toggle('is-far', gap > NAME_RANGE)
      thing.tag.classList.toggle('is-near', thing === near)
      thing.tag.style.transform = `translate(-50%, -100%) translate(${((spot.x + 1) / 2 * width).toFixed(1)}px, ${((1 - spot.y) / 2 * height).toFixed(1)}px)`
      thing.tag.style.zIndex = String(Math.round((1 - spot.z) * 100000))
    }
    return near
  }

  return { list, add, nearest, pick, update }
}
