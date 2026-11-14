// 森林地图：一张俯视的图，标着自己种的每一样和「你在这儿」。种下一颗种子时给它定位置，也在这张图上
import { h } from './core.js'
import { t } from '../i18n.js'
import { CABINS, CLEARING, HALL, HALL_WALK, LODGE, STREAM, trailX } from '../world/land.js'
import { HABITAT, SPOTS } from '../world/planted.js'
import { PLANTS, plantName } from '../world/plants/index.js'

const AREA = { west: -23, east: 36, north: -119, south: 55 }
const COLORS = { pine: '#2F7554', peach: '#F08DB0' }
// 图上的 1 差不多是屏幕上的 1 像素，记号的大小才好按像素定
const SCALE = 5
// 记号看着小，点它周围这么多像素以内都算点中
const REACH = 24

function s(tag, attributes = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
  node.append(...children)
  return node
}

// 北在上：森林里人就是往屏幕上方走的，地图和它一个方向。图比卡片长，上下滚着看
const point = (x, z) => [x - AREA.west, z - AREA.north].map(n => Math.round(n * SCALE))
const at = ({ x, z }) => `translate(${point(x, z).join(' ')})`
/// 一条折线，拐角抹圆：拐点当控制点，线从相邻两段的中点过
function curve(points) {
  const p = points.map(([x, z]) => point(x, z))
  return `M${p[0]}` + p.slice(1, -1).map((corner, k) => `Q${corner} ${[(corner[0] + p[k + 2][0]) / 2, (corner[1] + p[k + 2][1]) / 2]}`).join('') + `L${p.at(-1)}`
}
const spotOf = item => SPOTS[HABITAT[item.seed]]?.[item.slot]
/// 种进了林子里的每一样（位置排满以后长成的没有位置，不在图上）
const planted = ctx => ctx.garden.store.done.map(item => ({ item, spot: spotOf(item) })).filter(mark => mark.spot)

const house = (spot, label, zoom = '') => s('g', { class: 'house', transform: at(spot) + zoom }, s('path', { d: 'M-12 11V-3L0-13 12-3V11Z' }), s('text', { y: 3 }, label))

function land() {
  const trail = []
  for (let z = 52; z >= -116; z -= 4) trail.push([trailX(z), z])
  const spurs = [...CABINS.map(cabin => [[trailX(cabin.z), cabin.z], [cabin.x - cabin.side * 3.4, cabin.z]]), [[0, 6], [LODGE.x - 4, LODGE.z + 1.5]], HALL_WALK]
  return [
    s('path', { class: 'stream', d: curve(STREAM) }),
    s('circle', { class: 'clearing', r: 7 * SCALE, transform: at(CLEARING) }),
    ...spurs.map(spur => s('path', { class: 'spur', d: curve(spur) })),
    s('path', { class: 'trail', d: curve(trail) }),
    s('g', { class: 'fire', transform: at(CLEARING) }, s('path', { d: 'M0-11C6-4 7 0 7 3A7 7 0 0 1-7 3C-7 0-6-4 0-11Z' }), s('path', { d: 'M0-2C3 2 3.5 3 3.5 5A3.5 3.5 0 0 1-3.5 5C-3.5 3-3 2 0-2Z' })),
    s('text', { class: 'label', transform: at(CLEARING), y: 22 }, t('篝火')),
    ...CABINS.map((cabin, k) => house(cabin, k + 1)),
    house(LODGE, t('词'), ' scale(1.15)'),
    // 单词屋的字放在上面：门口的花在它下边
    s('text', { class: 'label', transform: at(LODGE), y: -26 }, t('单词屋')),
    house(HALL, t('讲'), ' scale(1.15)'),
    // 讲堂贴着地图的西边：字放在下面、和图标左边对齐，英文长出来的那截往右伸，不会出界
    s('text', { class: 'label', style: 'text-anchor: start', transform: at(HALL), x: -14, y: 24 }, t('讲堂')),
  ]
}

/// 记号按「类 + 颜色」画：树是尖顶带一截树干，花是五片花瓣
function glyph(seed) {
  const color = COLORS[seed] ?? 'var(--moss)'
  const parts = HABITAT[seed] === 'tree'
    ? [s('rect', { class: 'trunk', x: -1.5, y: 5, width: 3, height: 5 }), s('path', { d: 'M0-10 8 6H-8Z', fill: color })]
    : [...[0, 1, 2, 3, 4].map(k => s('circle', { r: 3.4, cx: Math.sin(k * Math.PI * 0.4) * 4.3, cy: -Math.cos(k * Math.PI * 0.4) * 4.3, fill: color })), s('circle', { class: 'heart', r: 2.6 })]
  return s('g', { class: 'glyph' }, ...parts)
}

/// 正要种下的这一颗能去的空位：[{ spot, slot }]，离篝火近的在前
const freeSlots = view => view.ctx.garden.free(view.picking.seed).map(slot => ({ slot, spot: SPOTS[HABITAT[view.picking.seed]][slot] }))

/// 离点下去的地方最近的那一个，太远就不算
function nearest(view, event, marks) {
  const matrix = view.svg.getScreenCTM()
  let best = null
  let reach = REACH
  for (const mark of marks) {
    const [x, y] = point(mark.spot.x, mark.spot.z)
    const gap = Math.hypot(matrix.a * x + matrix.e - event.clientX, matrix.d * y + matrix.f - event.clientY)
    if (gap < reach) { best = mark; reach = gap }
  }
  return best
}

function tap(view, event) {
  const hit = nearest(view, event, view.picking ? freeSlots(view) : planted(view.ctx))
  if (view.picking) { if (!hit) return; view.chosen = hit.slot } else view.chosen = hit?.item ?? null
  paint(view)
}

function head(view) {
  if (view.picking) return [h('h2', {}, t('把{name}种在哪儿', { name: plantName(view.picking.seed) })), h('p', {}, t('亮着的圈是空位，点哪个种哪个。种下就不能挪了。'))]
  // 每一种各种下了多少
  const done = planted(view.ctx)
  const counts = Object.keys(PLANTS).map(seed => [seed, done.filter(mark => mark.item.seed === seed).length]).filter(([, n]) => n)
  return [h('h2', {}, t('森林地图')), h('p', {}, counts.length ? counts.map(([seed, n]) => t('{name} {n} 棵', { name: plantName(seed), n })).join(' · ') : t('在单词屋把种子养大，它就会种到这里'))]
}

function action(view) {
  const { ctx, picking } = view
  const go = picking
    ? () => picking.onPick(view.chosen)
    // 先关再送：visit 自己关不关卡片都一样
    : () => { const spot = spotOf(view.chosen); ctx.ui.closeModal(); ctx.visit(spot) }
  return h('button', { class: 'button', type: 'button', onclick: go }, picking ? t('就种这儿') : t('去看看'))
}

/// 内容变了才换。换上去的会淡入（样式里写的），没变的不该跟着闪一下
function swap(node, key, make) {
  if (node.dataset.key === String(key)) return
  node.dataset.key = key
  node.replaceChildren(...make().filter(Boolean))
}

/// 选中的那个变了：把跟着它变的几块对上
function paint(view) {
  const { ctx, picking, chosen } = view
  const id = item => item && `${ctx.garden.store.done.indexOf(item)}:${item.slot}`
  for (const node of view.slots.children) node.classList.toggle('is-on', Number(node.dataset.slot) === chosen)
  if (!picking) swap(view.focus, id(chosen), () => [chosen && s('g', { transform: at(spotOf(chosen)) }, s('circle', { r: 13 }), glyph(chosen.seed))])
  view.foot.firstChild.disabled = chosen == null
}

/// 刚打开时把整张图画出来。之后会变的只有选中的那个（paint）
function draw(view) {
  const { ctx, picking } = view
  view.svg.setAttribute('viewBox', `0 0 ${point(AREA.east, AREA.south).join(' ')}`)
  view.land.replaceChildren(...land())
  view.marks.replaceChildren(...planted(ctx).map(({ item, spot }) => s('g', { transform: at(spot) }, s('circle', { class: 'hit', r: 14 }), glyph(item.seed))))
  view.you.setAttribute('transform', at(ctx.lodge.inside ? LODGE : ctx.player.position))
  view.head.replaceChildren(...head(view))
  view.foot.replaceChildren(action(view))
  view.foot.hidden = !picking && !planted(ctx).length
  // 挑位置时，已经种下的都压淡，亮着的只有空位
  view.marks.classList.toggle('is-dim', Boolean(picking))
  view.slots.classList.toggle('is-open', Boolean(picking))
  if (picking) view.slots.replaceChildren(...freeSlots(view).map(({ spot, slot }) => s('g', { 'data-slot': slot, transform: at(spot) }, s('circle', { class: 'hit', r: 14 }), s('circle', { class: 'ring', r: 7 }))))
  paint(view)
}

/// 森林地图。不带 pick：看自己种的在哪儿。带 pick：{ seed, onPick }，给正要种下的这一颗定位置——
/// 空位亮着圈，先替人选好离篝火最近的那个；点了「就种这儿」就调 onPick(slot)，卡片由调用的一方关。这一类得还有空位
export function openMap(ctx, { pick } = {}) {
  const view = { ctx, picking: pick ?? null, chosen: null }
  if (pick) view.chosen = ctx.garden.free(pick.seed)[0]
  const layer = name => view[name] = s('g', { class: `map-${name}` })
  view.svg = s('svg', { class: 'map-svg' }, layer('land'), layer('marks'), layer('you'), layer('slots'), layer('focus'))
  view.you.append(s('circle', { class: 'pulse', r: 10 }), s('circle', { r: 10 }), s('text', {}, t('你')))
  view.svg.addEventListener('click', event => tap(view, event))
  view.head = h('div', { class: 'grow' })
  view.foot = h('footer', { class: 'map-foot' })
  ctx.ui.openModal(h('section', { class: 'map sticker', 'aria-label': t('森林地图') },
    h('header', { class: 'drawer-head' }, view.head, h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
    h('div', { class: 'map-scroll' }, view.svg),
    view.foot))
  draw(view)
  // 一打开先滚到要看的地方：挑位置时是替人选好的那个圈，平时是自己站的地方。不用 scrollIntoView：它会连卡片一起滚
  const scroll = view.svg.parentNode
  const target = view.slots.querySelector('.is-on') ?? view.you
  scroll.scrollTop = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - scroll.clientHeight / 2
}
