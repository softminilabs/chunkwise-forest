import * as THREE from 'three'
import { createAudio } from './audio.js'
import { createInput, createRig } from './controls.js'
import { createFx } from './fx.js'
import { createPlayer } from './player.js'
import { createSounds } from './sounds.js'
import { createState } from './state.js'
import { createThings } from './things.js'
import { openChestCard } from './ui/chests.js'
import { createUI, h } from './ui/core.js'
import { createHud } from './ui/hud.js'
import { openPractice } from './ui/practice.js'
import { openReader } from './ui/reader.js'
import { openUnit } from './ui/unit.js'
import { createCabins } from './world/cabins.js'
import { createCamp } from './world/camp.js'
import { createChests } from './world/chests.js'
import { createLand } from './world/land.js'
import { createWeather } from './world/weather.js'
import { createWoods } from './world/woods.js'

const canvas = document.getElementById('stage')
// 画布是透明的：天空是页面背景上的一道渐变，远处的树靠雾淡进去
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(36, 1, 1, 400)
const load = url => fetch(url).then(response => response.json())

function resize() {
  // 像素比封顶：4K 屏上按满分辨率画，风扇会转起来，肉眼又看不出差别
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2, Math.sqrt(3.2e6 / (innerWidth * innerHeight))))
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}

function buildWorld(ctx) {
  const colliders = []
  const land = createLand(scene)
  const woods = createWoods(scene, colliders)
  const cabins = createCabins(scene, ctx.course, colliders)
  const weather = createWeather(scene, renderer, ctx.state)
  weather.onSeason((look, season) => { land.paint(look); woods.paint(look, season); cabins.paint(season) })
  weather.resolve()
  Object.assign(ctx, { scene, colliders, cabins, weather, camp: createCamp(scene, colliders), player: createPlayer(scene, colliders), fx: createFx(scene) })
}

function openCamp(ctx) {
  const { camp } = ctx
  const body = h('div', { class: 'drawer-rows' })
  const paint = () => body.replaceChildren(
    h('button', { class: 'button big', type: 'button', onclick: () => { camp.light(!camp.state.lit); ctx.audio.pop(); paint() } }, camp.state.lit ? '把火熄了' : '点燃篝火'),
    h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openPractice() }, '坐下来练一轮'),
    h('p', { class: 'note' }, '火点着了有噼啪声，离得越近越响。夜里它能照亮整块空地。'))
  paint()
  ctx.ui.openDrawer({ kicker: '林间空地', title: '篝火', sub: '学完一课，回来坐一会儿，把今天的卡片过一遍。', body })
}

/// 把木屋、单词屋、篝火登记成能用的东西；宝箱在 world/chests.js 里自己登记
function addPlaces(ctx) {
  const spot = cabin => new THREE.Vector3(cabin.x, cabin.y, cabin.z)
  for (const house of ctx.cabins.houses) {
    ctx.things.add({ kind: 'house', title: house.unit.zh, hint: house.unit.en, badge: house.unit.n, position: spot(house), spot: house.doorAt, stop: 1.3, height: house.height, radius: 3.4, reach: 5.8, face: house.face, use: () => openUnit(ctx, house) })
  }
  const { lodge } = ctx.cabins
  ctx.things.add({ kind: 'house', title: '单词屋', hint: '还在盖，下一步开门', badge: '词', position: spot(lodge), spot: lodge.doorAt, stop: 1.3, height: lodge.height, radius: 3.8, reach: 6, face: lodge.face, use: () => ctx.ui.toast('单词屋还在盖，<b>下一步</b>开门') })
  const camp = ctx.camp.state
  ctx.things.add({ kind: 'spot', title: '篝火', hint: '点火 · 坐下来练一轮', badge: '火', position: new THREE.Vector3(camp.x, camp.y, camp.z), height: 2, radius: 1.8, reach: 4.4, use: () => openCamp(ctx) })
}

function wire(ctx) {
  const pending = []
  ctx.approach = thing => {
    if (ctx.ui.busy) return
    const spot = thing.spot ?? thing.position
    ctx.player.goTo(spot.x, spot.z, thing.stop ?? thing.reach - 0.6, () => ctx.use(thing))
  }
  /// 用木屋的时候镜头转到门的正前方：看得见门脸，人也不会被屋子挡在后面
  ctx.use = thing => {
    ctx.ui.closeDrawer()
    if (thing.face != null) ctx.rig.yawGoal = thing.face
    thing.use()
  }
  ctx.openLesson = meta => { ctx.ui.closeDrawer(); return openReader(ctx, meta) }
  ctx.openPractice = options => { ctx.ui.closeDrawer(); openPractice(ctx, options) }
  ctx.continueLearning = () => {
    const next = ctx.state.next()
    const house = ctx.cabins.houses.find(item => item.unit.lessons.some(lesson => lesson.id === next.id))
    ctx.player.place(house.doorAt.x, house.doorAt.z)
    return ctx.openLesson(next)
  }
  ctx.onLesson = lesson => { ctx.cabins.setProgress(ctx.state.town.stars); pending.push(lesson) }
  /// 大卡片关上、回到森林了，才放烟花：盖着的时候放了也看不见
  ctx.celebrate = () => {
    if (ctx.ui.busy || !pending.length) return
    const lesson = pending.shift()
    const hit = ctx.cabins.pop(lesson.id)
    if (!hit) return
    const at = hit.lamp.getWorldPosition(new THREE.Vector3())
    ctx.fx.burst(at.x, at.y, at.z, 22)
    ctx.audio.chime(5)
    ctx.ui.toast(`第 ${lesson.n} 课 <b>${'★'.repeat(ctx.state.stars(lesson.id))}</b> 灯亮了`)
  }
  ctx.openChest = chest => {
    const fresh = !ctx.state.town.chests[chest.app.id]
    if (fresh) {
      ctx.state.patch({ chests: { ...ctx.state.town.chests, [chest.app.id]: Date.now() } })
      ctx.chests.paint(chest)
      const { x, y, z } = chest.root.position
      ctx.fx.burst(x, y + 1, z, 20)
      ctx.audio.chime(5)
    }
    openChestCard(ctx, chest.app, ctx.chests.found(), fresh)
  }
}

function start(ctx, hud) {
  const screen = document.getElementById('start')
  const button = screen.querySelector('button')
  const enter = () => { ctx.audio.unlock(); screen.classList.add('is-leaving'); setTimeout(() => { screen.hidden = true }, 500); hud.show(); canvas.focus() }
  button.disabled = false
  button.textContent = ctx.state.totals().lit ? '回到森林' : '走进森林'
  button.addEventListener('click', enter, { once: true })
  button.focus()
}

function frame(ctx, input, wish, dt, time) {
  const { player, weather } = ctx
  player.update(dt, time, input.wish(wish))
  if (wish.lengthSq() > 0.01 && ctx.ui.drawerOpen) ctx.ui.closeDrawer()
  // 会走了，底下那行操作提示就不用一直挂着
  if (player.state.moving) document.querySelector('.keys')?.classList.add('is-gone')
  ctx.rig.update(dt, player.position)
  weather.update(dt, time, player.position, camera)
  ctx.cabins.update(weather.now.night, dt, time)
  ctx.camp.update(dt, time, weather.now.night)
  ctx.chests.update(time, weather.now)
  ctx.fx.update(dt)
  ctx.celebrate()
  ctx.things.update(camera, player.position, time, innerWidth, innerHeight)
  renderer.render(scene, camera)
}

async function boot() {
  const [course, cards, apps] = await Promise.all(['data/course.json', 'data/cards.json', 'apps/apps.json'].map(load))
  const state = createState(course)
  const audio = createAudio(state)
  const rig = createRig(camera)
  const ctx = { course, cards, apps, state, audio, rig, camera, renderer, ui: createUI(rig, audio), sounds: createSounds(audio, state) }
  buildWorld(ctx)
  wire(ctx)
  ctx.things = createThings(document.getElementById('tags'), { onChoose: thing => ctx.approach(thing) })
  addPlaces(ctx)
  ctx.chests = createChests(ctx, chest => ctx.openChest(chest))
  ctx.cabins.setProgress(state.town.stars)
  const hud = createHud(ctx)
  const input = createInput(canvas, camera, rig, {
    onEscape: () => ctx.ui.escape(),
    onUse: () => { const thing = ctx.things.nearest(ctx.player.position); if (thing && !ctx.ui.busy) ctx.use(thing) },
    onHover: ray => ctx.things.hover(ray),
    onPick: ray => { const thing = ctx.things.pick(ray); if (thing) ctx.approach(thing); return Boolean(thing) },
    onGround: point => { ctx.ui.closeDrawer(); ctx.fx.ping(point.x, ctx.player.position.y, point.z); ctx.player.goTo(point.x, point.z) },
    groundY: () => ctx.player.position.y,
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
    last = now
    // 读课文、做练习时森林定住不动：余光里一直有东西在动也费眼，顺便省电。
    // 环境声只压低不停：雨声雷声照原样响的话，会盖住课文的录音
    ctx.sounds.update(ctx.weather.now, ctx.camp.state, ctx.player.position, ctx.ui.busy ? 0.3 : 1)
    if (ctx.ui.busy) return
    frame(ctx, input, wish, dt, now / 1000)
    const stride = Math.floor(ctx.player.state.stride / Math.PI)
    if (stride !== steps && ctx.player.state.moving) audio.step()
    steps = stride
  })
  start(ctx, hud)
}

boot().catch(error => {
  console.error(error)
  document.querySelector('#start button').textContent = '森林没搭起来，刷新试试'
})
