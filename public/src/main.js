import * as THREE from 'three'
import { createAudio } from './audio.js'
import { createInput, createRig } from './controls.js'
import { createFx } from './fx.js'
import { WORD_DROPS, createGarden } from './garden.js'
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
import { createLanternTree } from './world/lanterns.js'
import { HABITAT, SPOTS, createPlanted } from './world/planted.js'
import { createXmas } from './world/xmas.js'
import { ICONS, christmas, daysUntil, openCountdown, springFestival } from './ui/countdown.js'
import { createLodge } from './ui/lodge.js'
import { plantName } from './ui/seeds.js'
import { createWater } from './ui/water.js'
import { createVoice } from './words/deck.js'
import { createWordProgress } from './words/progress.js'
import { createLand, trailX } from './world/land.js'
import { PLANTS } from './world/plants/index.js'
import { createWeather } from './world/weather.js'
import { createWoods } from './world/woods.js'
import { lang, pick, setLang, t } from './i18n.js'

const canvas = document.getElementById('stage')
// 画布是透明的：天空是页面背景上的一道渐变，远处的树靠雾淡进去
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(36, 1, 1, 400)
document.title = t('组块森林 · 用文章学英语')
canvas.setAttribute('aria-label', t('组块森林'))
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
  const xmas = createXmas(scene, colliders)
  const lanterns = createLanternTree(scene, colliders)
  const planted = createPlanted(scene, colliders, weather)
  weather.onSeason((look, season) => { land.paint(look); woods.paint(look, season); cabins.paint(season); xmas.paint(look, season); lanterns.paint(look, season); planted.paint(look, season) })
  weather.resolve()
  Object.assign(ctx, { scene, colliders, cabins, weather, xmas, lanterns, planted, camp: createCamp(scene, colliders), player: createPlayer(scene, colliders), fx: createFx(scene) })
}

function openCamp(ctx) {
  const { camp } = ctx
  const raining = ctx.weather.now.weather === 'rain'
  const body = h('div', { class: 'drawer-rows' })
  const paint = () => body.replaceChildren(
    h('button', { class: 'button big', type: 'button', disabled: raining, onclick: () => { camp.light(!camp.state.lit); ctx.audio.pop(); paint() } }, raining ? t('下雨了，火点不着') : camp.state.lit ? t('把火熄了') : t('点燃篝火')),
    h('button', { class: 'button plain big', type: 'button', onclick: () => ctx.openPractice() }, t('坐下来练一轮')),
    h('p', { class: 'note' }, raining ? t('等雨停了再来点火。') : t('火点着了有噼啪声，离得越近越响。夜里它能照亮整块空地。')))
  paint()
  ctx.ui.openDrawer({ kicker: t('林间空地'), title: t('篝火'), sub: t('学完一课，回来坐一会儿，把今天的卡片过一遍。'), body })
}

/// 把木屋、单词屋、篝火登记成能用的东西；宝箱在 world/chests.js 里自己登记
function addPlaces(ctx) {
  const spot = cabin => new THREE.Vector3(cabin.x, cabin.y, cabin.z)
  for (const house of ctx.cabins.houses) {
    ctx.things.add({ kind: 'house', title: pick(house.unit), hint: lang === 'en' ? t('{n} 课', { n: house.unit.lessons.length }) : house.unit.en, badge: house.unit.n, position: spot(house), spot: house.doorAt, stop: 1.3, height: house.height, radius: 3.4, reach: 5.8, use: () => openUnit(ctx, house) })
  }
  const { lodge } = ctx.cabins
  const door = ctx.things.add({ kind: 'house', title: t('单词屋'), badge: t('词'), position: spot(lodge), spot: lodge.doorAt, stop: 1.3, height: lodge.height, radius: 3.8, reach: 6, use: () => ctx.lodge.enter() })
  // 牌子上写今天还有多少要学；学过词的屋子才「有人住」（夜里窗亮、烟囱冒烟），和九间木屋一个规矩
  const paintDoor = () => {
    const { progress } = ctx.words
    const due = progress.due().length
    const left = Math.max(0, progress.store.daily - progress.newToday())
    door.hint = due ? t('今天 {n} 个该复习', { n: due }) : left ? t('今天 {n} 个新词', { n: left }) : t('今天的学完了')
    ctx.things.refresh(door)
    lodge.lit = progress.learned().length > 0
  }
  ctx.words.progress.on(paintDoor)
  paintDoor()
  const camp = ctx.camp.state
  ctx.things.add({ kind: 'spot', title: t('篝火'), hint: t('点火 · 坐下来练一轮'), badge: t('火'), position: new THREE.Vector3(camp.x, camp.y, camp.z), height: 2, radius: 1.8, reach: 4.4, use: () => openCamp(ctx) })
}

/// 冬天才有的两样：开场位置右手边的圣诞树、左手边挂满大红灯笼的树。点它们看离圣诞节、离春节还有几天。
/// 返回这两样东西：不是冬天的时候它们只是两棵普通的树，要把「能点」关掉（frame 里）
function addFestive(ctx) {
  const xmas = { title: t('圣诞节'), day: christmas(), icon: ICONS.star }
  const spring = { title: t('春节'), day: springFestival(), icon: ICONS.lantern, note: t('正月初一') }
  const hint = festival => { const left = daysUntil(festival.day); return left ? t('离{name}还有 {n} 天', { name: festival.title, n: left }) : t('今天就是{name}', { name: festival.title }) }
  return [
    ctx.things.add({ kind: 'spot', title: t('圣诞树'), hint: hint(xmas), badge: '★', position: ctx.xmas.position, height: 6.4, radius: 2.2, reach: 4.6, use: () => openCountdown(ctx, xmas) }),
    ctx.things.add({ kind: 'spot', look: 'fu', title: t('灯笼'), hint: hint(spring), badge: '福', position: ctx.lanterns.position, height: 5.6, radius: 2.4, reach: 4.6, use: () => openCountdown(ctx, spring) }),
  ]
}

function wire(ctx) {
  const pending = []
  ctx.approach = thing => {
    if (ctx.ui.busy) return
    const spot = thing.spot ?? thing.position
    ctx.player.goTo(spot.x, spot.z, thing.stop ?? thing.reach - 0.6, () => ctx.use(thing))
  }
  // 打开东西的时候镜头不动：内容在屏幕中间出来，场景跟着转、跟着挪反而晃眼
  ctx.use = thing => {
    ctx.ui.closeDrawer()
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
    ctx.ui.toast(t('第 {n} 课 <b>{stars}</b> 灯亮了', { n: lesson.n, stars: '★'.repeat(ctx.state.stars(lesson.id)) }))
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

/// 花盆里养成的东西种进林子：跟着存档摆出来；地图和长成的卡片上的「去看看」把人送到它跟前
function plantOut(ctx) {
  /// 长成了的，在林子里有位置的那些
  const planted = () => ctx.garden.store.done.filter(item => item.slot != null)
  let shown = ''
  // 得水、浇水也会通知，林子里的只在种的东西变了时才重摆
  const plant = () => { const key = JSON.stringify(planted().map(item => [item.seed, item.slot])); if (key !== shown) { shown = key; ctx.planted.set(planted()) } }
  ctx.garden.on(plant)
  plant()
  /// 把人送到林子里某个位置跟前（地图上的「去看看」）。item：刚长成的那一棵，给了就让它当场从地里长出来
  ctx.visit = async (spot, item) => {
    ctx.ui.closeModal()
    ctx.ui.closeDrawer()
    // 站在它朝小路的那一侧
    const side = Math.sign(trailX(spot.z) - spot.x) || 1
    const arrive = () => {
      ctx.player.place(spot.x + side * 2.2, spot.z + 1.4)
      ctx.rig.focus.copy(ctx.player.position)
      // 先不摆它：等画面亮了再让它从地里冒出来
      if (item) ctx.planted.set(planted().filter(other => other !== item))
    }
    await (ctx.lodge.inside ? ctx.lodge.leave(arrive) : ctx.lodge.dip(arrive))
    if (!item) return
    ctx.planted.set(planted())
    ctx.audio.chime(5)
    ctx.fx.burst(spot.x, ctx.player.position.y + 1.6, spot.z, 18)
    await ctx.planted.sprout(item.seed, item.slot)
    ctx.ui.toast(t('{name}种在{where}了', { name: plantName(item.seed), where: spot.where }))
  }
}

function start(ctx, hud) {
  const screen = document.getElementById('start')
  const button = screen.querySelector('button')
  const reveal = () => { screen.classList.add('is-leaving'); setTimeout(() => { screen.hidden = true }, 500); hud.show(); canvas.focus() }
  const enter = () => { ctx.audio.unlock(); reveal() }
  button.disabled = false
  button.textContent = ctx.state.totals().lit ? t('回到森林') : t('走进森林')
  button.addEventListener('click', enter, { once: true })
  button.focus()
  screen.querySelector('.lang').addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'))
  // 在森林里换语言是整页重载，回来直接进森林。浏览器要等到下一次点按或按键才肯出声
  if (!sessionStorage.getItem('cw.resume')) return
  sessionStorage.removeItem('cw.resume')
  reveal()
  for (const kind of ['pointerdown', 'keydown']) addEventListener(kind, () => ctx.audio.unlock(), { once: true })
}

function frame(ctx, input, wish, dt, time) {
  const { player, weather } = ctx
  player.update(dt, time, input.wish(wish))
  if (wish.lengthSq() > 0.01 && ctx.ui.drawerOpen) ctx.ui.closeDrawer()
  // 会走了，底下那行操作提示就不用一直挂着
  if (player.state.moving) document.querySelector('.keys')?.classList.add('is-gone')
  ctx.rig.skyGoal = weather.now.weather === 'meteor' && !player.state.moving ? 1 : 0
  ctx.rig.update(dt, player.position)
  // 抬头看天的时候把牌子收起来：镜头一放低，远处的牌子全叠在天边
  document.body.classList.toggle('is-stargazing', ctx.rig.sky > 0.4)
  weather.update(dt, time, player.position, camera)
  ctx.cabins.update(weather.now.night, dt, time)
  ctx.xmas.update(weather.now.night, time)
  ctx.lanterns.update(weather.now.night, time)
  ctx.planted.update(dt)
  for (const thing of ctx.winterThings) thing.off = weather.now.season !== 'winter'
  ctx.camp.update(dt, time, weather.now.night, weather.now.weather === 'rain')
  ctx.chests.update(time, weather.now)
  ctx.fx.update(dt)
  ctx.celebrate()
  ctx.things.update(camera, player.position, time, innerWidth, innerHeight)
  renderer.render(scene, camera)
}

function listen(ctx) {
  return createInput(canvas, camera, ctx.rig, {
    // 在单词屋里，按键和点击都交给屋里那一套
    onEscape: () => ctx.lodge.inside ? ctx.lodge.escape() : ctx.ui.escape(),
    onUse: () => { if (ctx.lodge.inside) return ctx.lodge.use(); const thing = ctx.things.nearest(ctx.player.position); if (thing && !ctx.ui.busy) ctx.use(thing) },
    onHover: ray => ctx.lodge.inside ? ctx.lodge.hover(ray) : ctx.things.hover(ray),
    onPick: ray => { if (ctx.lodge.inside) return ctx.lodge.pick(ray); const thing = ctx.things.pick(ray); if (thing) ctx.approach(thing); return Boolean(thing) },
    onGround: point => { if (ctx.lodge.inside) return ctx.lodge.ground(point); ctx.ui.closeDrawer(); ctx.fx.ping(point.x, ctx.player.position.y, point.z); ctx.player.goTo(point.x, point.z) },
    groundY: () => ctx.lodge.inside ? 0 : ctx.player.position.y,
  })
}

async function boot() {
  const [course, cards, apps] = await Promise.all(['data/course.json', 'data/cards.json', 'apps/apps.json'].map(load))
  const state = createState(course)
  const audio = createAudio(state)
  const rig = createRig(camera)
  const ctx = { course, cards, apps, state, audio, rig, camera, renderer, ui: createUI(audio), sounds: createSounds(audio, state) }
  ctx.garden = createGarden(PLANTS, HABITAT, { tree: SPOTS.tree.length, flower: SPOTS.flower.length })
  ctx.water = createWater(ctx)
  // lessons：课文里收过的词卡（按小写的词头找）。单词屋里同一个词要带上那句课文
  ctx.words = { progress: createWordProgress(() => ctx.water.gain(WORD_DROPS)), voice: createVoice(), lessons: new Map(Object.values(cards).filter(card => card.kind === 'word').map(card => [card.text.toLowerCase(), card])) }
  buildWorld(ctx)
  wire(ctx)
  plantOut(ctx)
  ctx.things = createThings(document.getElementById('tags'), { onChoose: thing => ctx.approach(thing) })
  ctx.lodge = createLodge(ctx)
  addPlaces(ctx)
  ctx.winterThings = addFestive(ctx)
  ctx.chests = createChests(ctx, chest => ctx.openChest(chest))
  ctx.cabins.setProgress(state.town.stars)
  const hud = createHud(ctx)
  const input = listen(ctx)
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
    // 环境声：录音正在放（课文、听单词）就全关，要听清的是录音；大卡片开着但没在放，留一点点；
    // 在单词屋里坐下学词也压低。进了单词屋，外面的声音隔着墙只剩一点，屋里是壁炉的火声
    const hush = ctx.speaking ? 0 : ctx.ui.busy ? 0.15 : ctx.lodge.seated ? 0.35 : 1
    ctx.sounds.update(ctx.weather.now, ctx.camp.state, ctx.player.position, hush, ctx.lodge.inside ? 0.3 : 0)
    if (ctx.ui.busy) return
    if (ctx.lodge.inside) return ctx.lodge.frame(dt, now / 1000, input.wish(wish))
    frame(ctx, input, wish, dt, now / 1000)
    const stride = Math.floor(ctx.player.state.stride / Math.PI)
    if (stride !== steps && ctx.player.state.moving) audio.step()
    steps = stride
  })
  start(ctx, hud)
}

boot().catch(error => {
  console.error(error)
  document.querySelector('#start button').textContent = t('森林没搭起来，刷新试试')
})
