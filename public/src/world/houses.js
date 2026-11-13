// 九栋房子 = B1 的九个单元。每栋门楣上挂一串十个灯泡，一课一个：读完亮，拿到两颗星更亮
import * as THREE from 'three'
import { C } from '../palette.js'
import { at, ball, box, canvasTexture, drum, flat, group, pill, polar, toy } from '../toy.js'
import { HOUSE_RING, houseAngle } from './ground.js'

const STYLES = [
  { w: 5.2, h: 3.4, d: 4.6, wall: C.white, roof: 'gable', top: C.violet, door: C.ink },
  { w: 5.4, h: 3.2, d: 4.6, wall: C.lilac, roof: 'dome', top: C.lime, door: C.ink },
  { w: 4.4, h: 6.4, d: 4.2, wall: C.lilacPale, roof: 'slab', top: C.ink, door: C.violet },
  { w: 6.0, h: 3.2, d: 4.6, wall: C.ink, roof: 'slab', top: C.violet, door: C.lime },
  { w: 4.8, h: 5.0, d: 4.8, wall: C.white, roof: 'cone', top: C.violet, door: C.ink, round: true },
  { w: 6.0, h: 3.0, d: 4.8, wall: C.lime, roof: 'slab', top: C.white, door: C.ink },
  { w: 6.0, h: 3.0, d: 4.2, wall: C.white, roof: 'awning', top: C.lime, door: C.violet },
  { w: 5.6, h: 4.0, d: 4.6, wall: C.lilac, roof: 'gable', top: C.ink, door: C.white },
  { w: 5.0, h: 4.2, d: 4.6, wall: C.violet, roof: 'dome', top: C.white, door: C.lime },
]
const BULB = { off: C.bulbOff, one: C.lime, two: C.bulbTwo }
const pane = flat(C.pane, { glow: true })

function roofOf(style) {
  const { w, h, d, top } = style
  if (style.roof === 'gable') {
    // 一个转了 45° 的方柱子骑在墙顶上，露出来的上半截就是人字顶；前后不出檐，下半截才藏得进墙里
    const side = (w / 2 + 0.45) * Math.SQRT2
    const roof = toy(box(side, side, d - 0.1, 0.35), top, { outline: 0.14 })
    roof.rotation.z = Math.PI / 4
    return at(roof, 0, h - 0.1, 0)
  }
  if (style.roof === 'dome') return at(toy(ball(w * 0.46, 0.85), top, { outline: 0.14 }), 0, h - 0.2, 0)
  if (style.roof === 'cone') return at(toy(drum(0, w * 0.62, 3.2, 0.3), top, { outline: 0.14 }), 0, h - 0.15, 0)
  if (style.roof === 'awning') {
    const stripes = Array.from({ length: 6 }, (_, i) => at(toy(box(1.02, 0.5, 1.9, 0.2), i % 2 ? C.white : top, { outline: 0.1 }), -2.55 + i * 1.02, 0, 0))
    const awning = group(...stripes)
    awning.rotation.x = 0.32
    return group(at(toy(box(w + 0.4, 0.45, d + 0.4, 0.2), C.violet, { outline: 0.14 }), 0, h + 0.1, 0), at(awning, 0, h - 0.55, d / 2 + 0.75))
  }
  return at(toy(box(w + 0.5, 0.55, d + 0.5, 0.24), top, { outline: 0.14 }), 0, h + 0.15, 0)
}

function sign(text, background, color) {
  const texture = canvasTexture(256, 128, (context, width, height) => {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
    context.fillStyle = color
    context.font = '800 76px ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, width / 2, height / 2 + 4)
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshBasicMaterial({ map: texture }))
}

/// 每栋房子一件看得出主题的小东西
function propOf(index, style) {
  const { w, h, d } = style
  const builders = [
    () => group(at(toy(box(0.8, 1.5, 0.8, 0.2), C.ink, { outline: 0.1 }), 1.3, h + 1.5, -0.6), at(toy(box(1.0, 0.8, 0.9, 0.16), C.creamDeep, { outline: 0.1 }), w / 2 + 0.9, 0.4, d / 2 - 0.4), at(toy(box(0.8, 0.6, 0.7, 0.14), C.lilacPale, { outline: 0.1 }), w / 2 + 0.95, 1.1, d / 2 - 0.45)),
    () => group(...[[C.violet, -0.5, 2.6], [C.white, 0.3, 3.2], [C.ink, 0.9, 2.4]].map(([color, x, y]) => group(at(toy(ball(0.55, 1.15), color, { outline: 0.1 }), x + w / 2 - 0.2, h + y, 0.6), at(toy(pill(0.03, y - 0.4), C.ink, { outline: 0 }), x + w / 2 - 0.2, h + y / 2 - 0.3, 0.6)))),
    () => group(at(toy(pill(0.07, 1.6), C.ink, { outline: 0.06 }), 0.9, h + 1.4, 0), at(toy(ball(0.2), C.lime, { outline: 0.08 }), 0.9, h + 2.4, 0), ...[1.9, 3.3, 4.7].flatMap(y => [-1.05, 1.05].map(x => at(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), pane), x, y, d / 2 + 0.02)))),
    () => group(at(toy(box(2.6, 1.5, 0.3, 0.2), C.ink, { outline: 0.12 }), 0, h + 1.35, 0), at(sign('</>', C.ink, C.lime), 0, h + 1.35, 0.17), at(toy(pill(0.09, 0.4), C.white, { outline: 0.06 }), 0, h + 0.5, 0)),
    () => group(at(toy(pill(0.07, 2.2), C.ink, { outline: 0.06 }), w / 2 + 1.2, 1.2, d / 2 - 0.2), at(toy(box(1.3, 0.4, 0.14, 0.1), C.lime, { outline: 0.08 }), w / 2 + 1.75, 2.1, d / 2 - 0.2), at(toy(box(1.1, 0.4, 0.14, 0.1), C.violet, { outline: 0.08 }), w / 2 + 0.75, 1.55, d / 2 - 0.2), at(toy(box(0.9, 0.7, 0.45, 0.14), C.ink, { outline: 0.1 }), -w / 2 - 0.8, 0.35, d / 2)),
    () => { const bar = toy(pill(0.1, 1.5), C.ink, { outline: 0.07 }); bar.rotation.z = Math.PI / 2; return group(at(bar, 0, h + 0.95, 0), at(toy(ball(0.45), C.ink, { outline: 0.1 }), -0.95, h + 0.95, 0), at(toy(ball(0.45), C.ink, { outline: 0.1 }), 0.95, h + 0.95, 0)) },
    () => group(at(toy(box(1.0, 0.7, 0.8, 0.12), C.lilac, { outline: 0.1 }), -w / 2 - 0.2, 0.35, d / 2 + 1.5), at(toy(ball(0.26), C.lime, { outline: 0.07 }), -w / 2 - 0.4, 0.85, d / 2 + 1.5), at(toy(ball(0.26), C.violet, { outline: 0.07 }), -w / 2 + 0.05, 0.85, d / 2 + 1.45)),
    () => group(...[-1.9, 1.9].map(x => at(toy(drum(0.24, 0.28, h - 0.3, 0.08, 18), C.white, { outline: 0.09 }), x, 0, d / 2 + 0.35)), at(toy(box(1.3, 0.3, 1.0, 0.1), C.lime, { outline: 0.09 }), w / 2 + 1.0, 0.15, d / 2 - 0.3), at(toy(box(1.1, 0.3, 0.9, 0.1), C.white, { outline: 0.09 }), w / 2 + 1.05, 0.45, d / 2 - 0.25)),
    () => { const dish = toy(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), C.lime, { outline: 0.1 }); dish.rotation.set(Math.PI * 0.85, 0, 0.5); return group(at(dish, 1.1, h + 2.5, 0.2), at(toy(pill(0.06, 0.9), C.ink, { outline: 0.05 }), 1.1, h + 1.9, 0.2)) },
  ]
  return builders[index]()
}

function buildHouse(unit, index) {
  const style = STYLES[index]
  const { w, h, d } = style
  const body = style.round ? toy(drum(w / 2, w / 2 + 0.1, h, 0.3), style.wall, { outline: 0.14 }) : at(toy(box(w, h, d, 0.45), style.wall, { outline: 0.14 }), 0, h / 2, 0)
  const front = style.round ? w / 2 + 0.1 : d / 2
  const door = at(toy(box(1.25, 1.9, 0.24, 0.28), style.door, { outline: 0.1 }), 0, 0.95, front)
  const knob = at(toy(ball(0.09), style.door === C.ink ? C.lime : C.ink, { outline: 0 }), 0.36, 0.95, front + 0.15)
  const windows = style.round || index === 2 ? [] : [-1.65, 1.65].map(x => group(at(toy(box(1.08, 1.08, 0.12, 0.2), C.white, { outline: 0.08 }), x, 1.95, front), at(new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), pane), x, 1.95, front + 0.07)))
  const bulbs = Array.from({ length: 10 }, (_, k) => {
    const t = k / 9 - 0.5
    const material = new THREE.MeshBasicMaterial({ color: BULB.off })
    const bulb = new THREE.Mesh(ball(0.15), material)
    const x = t * (Math.min(w, 5.4) - 0.7)
    const depth = style.round ? Math.sqrt(Math.max(0.1, front * front - x * x)) + 0.12 : front + 0.14
    return at(bulb, x, Math.min(h, 3.4) - 0.34 - Math.cos(t * Math.PI) * 0.16, depth)
  })
  const root = group(body, roofOf(style), door, knob, ...windows, ...bulbs, propOf(index, style))
  const { x, z } = polar(houseAngle(index), HOUSE_RING)
  root.position.set(x, 0, z)
  root.rotation.y = Math.atan2(-x, -z)
  return { unit, root, bulbs, x, z, height: (style.roof === 'slab' ? h + 1 : h + 2.4), doorAt: polar(houseAngle(index), HOUSE_RING - front - 1.3) }
}

export function createHouses(scene, course, colliders) {
  const houses = course.units.map(buildHouse)
  for (const house of houses) {
    scene.add(house.root)
    colliders.push({ x: house.x, z: house.z, r: 3.5 })
  }
  const day = new THREE.Color(C.pane)
  const lit = new THREE.Color(C.glow)
  return {
    houses,
    /// stars：{ 课 id: 星数 }
    setProgress(stars) {
      for (const house of houses) house.unit.lessons.forEach((lesson, k) => {
        const count = stars[lesson.id] ?? 0
        house.bulbs[k].material.color.set(count >= 2 ? BULB.two : count === 1 ? BULB.one : BULB.off)
        house.bulbs[k].userData.size = count >= 2 ? 1.5 : count === 1 ? 1.25 : 1
        house.bulbs[k].scale.setScalar(house.bulbs[k].userData.size)
      })
    },
    /// 刚点亮的那盏灯弹一下
    pop(lessonId) {
      for (const house of houses) { const k = house.unit.lessons.findIndex(lesson => lesson.id === lessonId); if (k >= 0) { house.bulbs[k].userData.pop = 1; return { house, bulb: house.bulbs[k] } } }
      return null
    },
    update(night, dt) {
      pane.color.copy(day).lerp(lit, Math.min(1, night * 1.4))
      for (const house of houses) for (const bulb of house.bulbs) {
        if (!(bulb.userData.pop > 0)) continue
        bulb.userData.pop -= dt * 1.1
        bulb.scale.setScalar((bulb.userData.size ?? 1) * (1 + Math.sin(Math.max(0, bulb.userData.pop) * Math.PI) * 1.6))
      }
    },
  }
}
