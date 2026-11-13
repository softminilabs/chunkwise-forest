import * as THREE from 'three'
import { createApps } from './apps/index.js'
import { createAudio } from './audio.js'
import { createInput, createRig } from './controls.js'
import { createFx } from './fx.js'
import { createPlayer } from './player.js'
import { createState } from './state.js'
import { createThings } from './things.js'
import { polar } from './toy.js'
import { createUI } from './ui/core.js'
import { createHud } from './ui/hud.js'
import { openPractice } from './ui/practice.js'
import { openReader } from './ui/reader.js'
import { openUnit } from './ui/unit.js'
import { createArcade } from './world/arcade.js'
import { createGround, createTrees } from './world/ground.js'
import { createHouses } from './world/houses.js'
import { createSky } from './world/sky.js'

const canvas = document.getElementById('stage')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.shadowMap.enabled = true
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(34, 1, 2, 400)
const load = url => fetch(url).then(response => response.json())

function resize() {
  // 像素比封顶：4K 屏上按满分辨率画，风扇会转起来，肉眼又看不出差别
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2, Math.sqrt(3.2e6 / (innerWidth * innerHeight))))
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}

function buildWorld(ctx) {
  const sky = createSky(scene)
  const ground = createGround(scene, sky)
  const colliders = ground.colliders
  const trees = createTrees(scene, colliders)
  const town = createHouses(scene, ctx.course, colliders)
  const spot = polar(150, 6.4)
  const arcade = createArcade(scene, colliders, spot.x, spot.z)
  const player = createPlayer(scene, colliders)
  Object.assign(ctx, { scene, sky, colliders, town, player, fx: createFx(scene) })
  return { ground, trees, arcade }
}

/// 把房子和扭蛋机登记成能用的东西；我的 App 那些物件在 apps/ 里自己登记
function addPlaces(ctx, arcade) {
  for (const house of ctx.town.houses) {
    ctx.things.add({ kind: 'house', title: house.unit.zh, hint: house.unit.en, badge: house.unit.n, position: new THREE.Vector3(house.x, 0, house.z), spot: house.doorAt, stop: 1.3, height: house.height, radius: 3.4, reach: 5.4, use: () => openUnit(ctx, house) })
  }
  ctx.things.add({ kind: 'spot', title: '练习场', hint: '连连看 · 听一句 · 填个空', badge: '玩', position: new THREE.Vector3(arcade.x, 0, arcade.z), height: arcade.height, radius: 1.8, reach: 4, use: () => ctx.openPractice() })
}

function wire(ctx) {
  const pending = []
  ctx.approach = thing => {
    if (ctx.ui.busy) return
    const spot = thing.spot ?? thing.position
    ctx.player.goTo(spot.x, spot.z, thing.stop ?? thing.reach - 0.6, () => ctx.use(thing))
  }
  /// 房子和 App 物件的正面都朝着广场：用它的时候镜头转到广场这一侧，看得见正面，人也不会被挡在后面
  ctx.use = thing => {
    ctx.ui.closeDrawer()
    if (thing.kind !== 'spot' && !thing.steady && Math.hypot(thing.position.x, thing.position.z) > 3) ctx.rig.yawGoal = Math.atan2(-thing.position.x, -thing.position.z)
    thing.use()
  }
  /// 从目录里点一样东西：人直接站到它正前方两三步的地方，再用它
  ctx.visit = thing => {
    const { x, z } = thing.position
    const onStreet = thing.steady && Math.abs(x) > 1
    const far = Math.hypot(x, z)
    const [dx, dz] = onStreet ? [-Math.sign(x), 0] : far > 1 ? [-x / far, -z / far] : [0, 1]
    const step = thing.reach - 0.9
    ctx.player.place(x + dx * step, z + dz * step)
    ctx.use(thing)
  }
  ctx.openLesson = meta => { ctx.ui.closeDrawer(); return openReader(ctx, meta) }
  ctx.openPractice = options => { ctx.ui.closeDrawer(); openPractice(ctx, options) }
  ctx.continueLearning = () => {
    const next = ctx.state.next()
    const house = ctx.town.houses.find(item => item.unit.lessons.some(lesson => lesson.id === next.id))
    ctx.player.place(house.doorAt.x, house.doorAt.z)
    return ctx.openLesson(next)
  }
  /// 天色：跟着真实时间，或者固定成白天 / 夜晚（夜晚暗，眼睛累了可以切过去）
  ctx.applyLight = () => ctx.sky.setHour({ day: 11, night: 21.5 }[ctx.state.town.light] ?? null)
  ctx.onLesson = lesson => { ctx.town.setProgress(ctx.state.town.stars); pending.push(lesson) }
  /// 大卡片关上、回到小镇了，才放烟花：盖着的时候放了也看不见
  ctx.celebrate = () => {
    if (ctx.ui.busy || !pending.length) return
    const lesson = pending.shift()
    const hit = ctx.town.pop(lesson.id)
    if (!hit) return
    const at = hit.bulb.getWorldPosition(new THREE.Vector3())
    ctx.fx.burst(at.x, at.y, at.z, 22)
    ctx.audio.chime(5)
    ctx.ui.toast(`第 ${lesson.n} 课 <b>${'★'.repeat(ctx.state.stars(lesson.id))}</b> 灯亮了`)
  }
}

function start(ctx, hud) {
  const screen = document.getElementById('start')
  const button = screen.querySelector('button')
  const enter = () => { ctx.audio.unlock(); screen.classList.add('is-leaving'); setTimeout(() => { screen.hidden = true }, 500); hud.show(); canvas.focus() }
  button.disabled = false
  button.textContent = ctx.state.totals().lit ? '回到小镇' : '进小镇'
  button.addEventListener('click', enter, { once: true })
  button.focus()
}

async function boot() {
  const [course, cards, apps] = await Promise.all(['data/course.json', 'data/cards.json', 'apps/apps.json'].map(load))
  const state = createState(course)
  const audio = createAudio(state)
  const rig = createRig(camera)
  const ctx = { course, cards, apps, state, audio, rig, camera, renderer, ui: createUI(rig, audio) }
  const world = buildWorld(ctx)
  wire(ctx)
  ctx.things = createThings(document.getElementById('tags'), { onChoose: thing => ctx.approach(thing) })
  addPlaces(ctx, world.arcade)
  const myApps = createApps(ctx)
  ctx.town.setProgress(state.town.stars)
  ctx.applyLight()
  const hud = createHud(ctx)
  const input = createInput(canvas, camera, rig, {
    onEscape: () => ctx.ui.escape(),
    onUse: () => { const thing = ctx.things.nearest(ctx.player.position); if (thing && !ctx.ui.busy) ctx.use(thing) },
    onPick: ray => { const thing = ctx.things.pick(ray); if (thing) ctx.approach(thing); return Boolean(thing) },
    onGround: point => { ctx.ui.closeDrawer(); ctx.player.goTo(point.x, point.z) },
  })
  const wish = new THREE.Vector3()
  let last = performance.now()
  let steps = 0
  resize()
  addEventListener('resize', resize)
  // 调试和自动检查用的口子
  window.town = ctx
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000)
    const time = now / 1000
    last = now
    // 读课文、做练习时小镇定住不动：余光里一直有东西在动也费眼，顺便省电
    if (ctx.ui.busy) return
    ctx.player.update(dt, time, input.wish(wish))
    if (wish.lengthSq() > 0.01 && ctx.ui.drawerOpen) ctx.ui.closeDrawer()
    const stride = Math.floor(ctx.player.state.stride / Math.PI)
    if (stride !== steps && ctx.player.state.moving) audio.step()
    // 会走了，底下那行操作提示就不用一直挂着
    if (ctx.player.state.moving) document.querySelector('.keys')?.classList.add('is-gone')
    steps = stride
    rig.update(dt, ctx.player.position)
    ctx.sky.update(ctx.player.position)
    world.ground.update(time)
    world.trees.update(time)
    world.arcade.update(time)
    ctx.town.update(ctx.sky.state.night, dt)
    myApps.update(dt, time)
    ctx.fx.update(dt)
    ctx.celebrate()
    ctx.things.update(camera, ctx.player.position, time, innerWidth, innerHeight)
    renderer.render(scene, camera)
  })
  start(ctx, hud)
}

boot().catch(error => {
  console.error(error)
  document.querySelector('#start button').textContent = '小镇没搭起来，刷新试试'
})
