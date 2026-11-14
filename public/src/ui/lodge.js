// 单词屋：屋里是另一个场景（world/room.js），用的是同一台镜头、同一套按键。
// 这里管进出、在屋里走动、屋里几样东西各开什么：书桌 = 今天的词，书架 = 词库，留声机 = 听单词，花盆 = 选种子和浇水，门 = 回森林
import * as THREE from 'three'
import { h } from './core.js'
import { t } from '../i18n.js'
import { createPlayer } from '../player.js'
import { createThings } from '../things.js'
import { PLACES, ROOM_COLLIDERS, ROOM_GROUND, SEATS, createRoom } from '../world/room.js'
import { HABITAT, SPOTS } from '../world/planted.js'
import { PLANTS, plantName } from '../world/plants/index.js'
import { portrait } from '../world/portrait.js'
import { loadIndex, loadLevel } from '../words/deck.js'
import { openSeeds } from './seeds.js'
import { openDesk } from './words-desk.js'

const FADE = 340
const wait = ms => new Promise(done => setTimeout(done, ms))

export function createLodge(ctx) {
  const room = createRoom()
  const player = createPlayer(room.scene, ROOM_COLLIDERS, ROOM_GROUND)
  const fade = document.getElementById('fade')
  const seat = document.getElementById('seat')
  const hud = document.querySelector('.room-hud')
  const brand = h('small', {})
  // tending：浇水的动画正放着；planted：花盆里现在摆的是哪种、浇到第几滴（变了才重摆模型）
  const state = { inside: false, seat: null, busy: false, ready: 0, yaw: 0, steps: 0, leaveSeat: null, done: null, fading: null, tending: false, planted: '' }
  const things = createThings(document.getElementById('room-tags'), { onChoose: thing => approach(thing), chrome: '.room-hud > *' })
  const add = (key, thing) => things.add({ kind: 'house', ...PLACES[key], position: new THREE.Vector3(...PLACES[key].position), ...thing })
  const desk = add('desk', { title: t('今天的词'), badge: t('词'), use: () => sit('desk', openDesk) })
  add('shelf', { title: t('词库'), badge: t('书'), use: openShelf })
  add('gramophone', { title: t('听单词'), badge: t('听'), use: () => listenHere() })
  // 先走到花盆跟前再动手
  const pot = add('pot', { title: t('花盆'), badge: t('种'), use: () => player.goTo(...PLACES.pot.spot, 0.35, tend) })
  add('door', { title: t('回森林'), badge: t('门'), use: leave })
  hud.append(h('button', { class: 'pill', type: 'button', onclick: () => leave() }, t('← 回森林')), h('div', { class: 'brand sticker' }, h('strong', {}, t('单词屋')), brand), ctx.water.chip())

  /// 今天还有几个要复习、几个新词可学。屋外的牌子、屋里书桌的牌子、顶栏上那行字都用它
  async function plan() {
    const { progress } = ctx.words
    const left = Math.max(0, progress.store.daily - progress.newToday())
    return { due: progress.due().length, fresh: progress.newWords(await loadLevel(progress.store.level), left).length, learned: progress.learned() }
  }

  /// 花盆里摆的模型、头顶的牌子，跟着存着的进度走
  function paintPot() {
    const { store } = ctx.garden
    const key = `${store.seed}:${store.poured}`
    if (key !== state.planted) { state.planted = key; room.pot.plant(store.seed ? PLANTS[store.seed] : null, ctx.garden.grown) }
    pot.title = store.seed ? plantName(store.seed) : t('花盆')
    pot.badge = store.seed ? t('水') : t('种')
    pot.hint = store.seed ? [t('浇了 {a} / {b} 滴', { a: store.poured, b: ctx.garden.need }), store.water ? t('壶里有 {n} 滴', { n: store.water }) : t('壶里没水')].join(' · ') : t('选一颗种子')
    pot.height = room.pot.top
    things.refresh(pot)
  }

  /// 荣誉墙上写什么、挂哪些卡片。words：学会了几个词
  function honors(words) {
    const { done } = ctx.garden.store
    return {
      title: t('荣誉墙'), empty: t('种的东西长成了，就挂到这里'),
      stats: [t('长成 {n} 棵', { n: done.length }), t('学会 {n} 个词', { n: words }), t('听完 {n} 课', { n: ctx.state.totals().lit })].join(' · '),
      cards: done.map(item => ({ id: item.seed, image: portrait(PLANTS[item.seed], 4) })),
    }
  }

  async function paint() {
    // 浇水的动画正放着：花盆和牌子先不动，放完再对一遍
    if (state.tending) return
    const now = await plan()
    desk.hint = now.due || now.fresh ? [now.due && t('复习 {n} 个', { n: now.due }), now.fresh && t('新词 {n} 个', { n: now.fresh })].filter(Boolean).join(' · ') : t('今天的学完了')
    things.refresh(desk)
    brand.textContent = t('在学 {level} · 学过 {n} 个', { level: ctx.words.progress.store.level, n: now.learned.length })
    paintPot()
    room.setHonors(honors(now.learned.length))
    // 书架按在学的这一级学过几成上色
    const level = (await loadIndex()).levels.find(item => item.id === ctx.words.progress.store.level)
    room.setShelf(now.learned.filter(ref => ref.lv === level.id).length / level.count)
  }

  async function swap(change) {
    if (state.busy) return
    state.busy = true
    fade.classList.add('is-on')
    await wait(FADE)
    change()
    fade.classList.remove('is-on')
    await wait(FADE)
    state.busy = false
  }

  async function enter() {
    if (state.inside) return
    paint()
    await swap(() => {
      state.inside = true
      state.yaw = ctx.rig.yaw
      document.body.classList.add('is-inside')
      player.sit(false)
      player.place(ROOM_GROUND.start.x, ROOM_GROUND.start.z)
      player.root.rotation.y = -Math.PI / 2
      room.look('room', true)
      // 进门先往里走几步，停在书桌前：一进来按空格就是学词，而不是又出去了。走到之前不接「用」
      state.ready = performance.now() + 1500
      player.goTo(PLACES.desk.spot[0] + 1.1, PLACES.desk.spot[1] + 0.6, 0.3)
    })
    // 头一回进屋、盆还空着：等他走到书桌前，提示选一颗种子。只提示这一回，之后花盆的牌子上一直写着
    const { store } = ctx.garden
    if (store.seed || store.asked) return
    await wait(1300)
    if (!state.inside || state.seat || ctx.ui.busy) return
    ctx.garden.set({ asked: true })
    openSeeds(ctx)
  }

  /// then：画面还黑着的时候顺手做的事（「去林子里看看」要在这时候把人挪到那棵树跟前）
  function leave(then) {
    if (!state.inside || state.seat || state.tending) return
    dismiss()
    return swap(() => {
      state.inside = false
      ctx.rig.yaw = state.yaw
      document.body.classList.remove('is-inside', 'is-night')
      then?.()
    })
  }

  /// 学完一轮回到屋里，底下出一条结果；一走动、一用东西就收起来
  function report(result) {
    dismiss()
    if (!result) return
    state.done = h('div', { class: 'room-done sticker' },
      h('div', {}, h('strong', {}, t('这一轮 {n} 个词学完了', { n: result.count }), h('span', { class: 'water-got' }, h('i', { class: 'drop' }), t('得到 {n} 滴水', { n: result.count }))),
        h('small', {}, [t('第一次就记得的 {p}%', { p: result.firstTry }), t('明天有 {n} 个该复习', { n: ctx.words.progress.dueTomorrow() })].join(' · '))),
      h('button', { class: 'button', type: 'button', onclick: () => approach(pot) }, ctx.garden.store.seed ? t('去浇水') : t('去选种子')),
      h('button', { class: 'button plain', type: 'button', onclick: () => sit('desk', openDesk) }, t('接着学')),
      h('button', { class: 'button plain', type: 'button', onclick: () => leave() }, t('回森林')))
    document.body.append(state.done)
  }
  function dismiss() { state.done?.remove(); state.done = null }

  /// 坐下：镜头推过去，#seat 里的内容交给 open 去搭。open 返回「起身时要收拾什么」
  function sit(kind, open, options) {
    if (state.seat || state.tending) return
    dismiss()
    // 上一次起身的淡出还没完就又坐下了：不等它
    state.fading?.cancel()
    state.fading = null
    const [x, y, z, face] = SEATS[kind]
    player.place(x, z)
    player.position.y = y
    player.root.rotation.y = face
    player.sit(true)
    room.look(kind)
    state.seat = kind
    document.body.dataset.seat = kind
    seat.dataset.kind = kind
    seat.hidden = false
    state.leaveSeat = open(ctx, seat, { stand, ...options })
    seat.querySelector('.paper').append(h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => stand() }, '✕'))
  }

  function stand(result) {
    if (!state.seat) return
    state.leaveSeat?.()
    state.leaveSeat = null
    // 和别的卡片一样：淡出去再收起来
    state.fading = seat.animate({ opacity: [1, 0] }, { duration: 180, easing: 'ease-in' })
    state.fading.onfinish = () => { seat.hidden = true; seat.replaceChildren(); state.fading = null }
    delete document.body.dataset.seat
    const [x, , z] = SEATS[state.seat]
    player.sit(false)
    // 起身站到座位朝屋子中间的那一侧
    player.place(x + 0.9, z + 0.7)
    room.look('room')
    state.seat = null
    paint()
    report(result)
  }

  async function openShelf() {
    const { openLibrary } = await import('./words-library.js')
    openLibrary(ctx, { onListen: refs => listenHere(refs) })
  }

  /// 坐到壁炉前听。refs：指定听哪一组（词库页点「听这一组」）
  async function listenHere(refs = null) {
    const { createListen } = await import('./words-listen.js')
    sit('listen', (_, node) => {
      const listen = createListen(ctx, { refs })
      node.replaceChildren(h('header', { class: 'seat-bar' }, h('button', { class: 'pill', type: 'button', onclick: () => stand() }, t('← 回屋里'))),
        h('article', { class: 'paper' }, h('div', { class: 'paper-in' }, listen.node)))
      listen.start()
      return () => listen.stop()
    })
  }

  /// 不进屋，在森林里直接开「听单词」：一张大卡片
  async function listenOutside() {
    const { createListen } = await import('./words-listen.js')
    const listen = createListen(ctx)
    ctx.ui.openModal(h('section', { class: 'listen-card sticker', 'aria-label': t('听单词') },
      h('header', { class: 'reader-head' }, h('div', { class: 'grow' }), h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
      listen.node), () => listen.stop())
    listen.start()
  }

  /// 花盆：空着就选种子；有水就浇，浇够了长成
  async function tend() {
    const { garden } = ctx
    if (state.tending) return
    if (!garden.store.seed) return openSeeds(ctx)
    if (!garden.store.water) return ctx.ui.toast(t('壶里没水了。学完一个词得 1 滴，听完一课得 3 滴'))
    state.tending = true
    document.body.dataset.tending = ''
    const [x, z] = PLACES.pot.spot
    player.place(x, z)
    player.root.rotation.y = Math.atan2(PLACES.pot.position[0] - x, PLACES.pot.position[2] - z)
    room.look('pot')
    const { seed, poured, grown, bloomed, item } = garden.pour()
    // 等镜头推到跟前再开始浇
    await wait(600)
    ctx.audio.pour()
    await room.pot.water(grown)
    if (bloomed) { ctx.audio.chime(6); await room.pot.bloom() }
    room.look('room')
    state.tending = false
    delete document.body.dataset.tending
    paint()
    if (bloomed) celebrate(item)
    else ctx.ui.toast(t('浇了 {n} 滴，{name}还差 {m} 滴长成', { n: poured, name: plantName(seed), m: garden.need - garden.store.poured }))
  }

  /// 长成了：墙上挂一张，林子里已经给它占了一个位置（item.slot）。可以去看它种下去、接着种下一颗
  function celebrate(item) {
    const plant = PLANTS[item.seed]
    // 这一类的位置种满了的话没有 spot：只挂在墙上
    const spot = SPOTS[HABITAT[item.seed]][item.slot]
    const next = (label, go) => h('button', { class: 'chip', type: 'button', onclick: () => { ctx.ui.closeDrawer(); go() } }, label)
    ctx.ui.openDrawer({
      kicker: t('荣誉墙 · 第 {n} 棵', { n: ctx.garden.store.done.length }), title: t('{name}长成了', { name: plantName(item.seed) }),
      sub: spot ? t('一共浇了 {n} 滴水。墙上挂了一张，它种在{where}。', { n: plant.drops, where: spot.where }) : t('一共浇了 {n} 滴水。墙上挂了一张；林子里这一类的位置已经种满了。', { n: plant.drops }),
      body: [h('img', { class: 'bloom-shot', src: portrait(plant, 4).toDataURL(), alt: '' }),
        spot && h('button', { class: 'button big', type: 'button', onclick: () => ctx.visit(spot, item) }, t('去林子里看看')),
        h('div', { class: 'row center' }, next(t('再种一颗'), () => openSeeds(ctx)))],
    })
  }

  function approach(thing) {
    if (state.seat || state.tending || ctx.ui.busy || performance.now() < state.ready) return
    dismiss()
    player.goTo(thing.spot[0], thing.spot[1], 0.35, () => thing.use())
  }

  ctx.words.progress.on(paint)
  ctx.garden.on(paint)
  return {
    enter, leave, plan, listenOutside,
    /// 画面暗一下再亮：暗着的时候做 change。在林子里把人一下挪到远处时用它，免得镜头横穿整片森林
    dip: swap,
    get inside() { return state.inside },
    get seated() { return Boolean(state.seat) },
    use() { const thing = things.nearest(player.position); if (thing && !state.seat && !state.tending && performance.now() > state.ready) { dismiss(); thing.use() } },
    escape() { if (state.seat) stand(); else ctx.ui.escape() },
    hover: ray => things.hover(ray),
    pick(ray) { const thing = things.pick(ray); if (thing) approach(thing); return Boolean(thing) },
    ground(point) { if (state.tending) return; dismiss(); player.goTo(point.x, point.z) },
    frame(dt, time, wish) {
      // 在屋里镜头不转：按键的方向以正对后墙为准。拖动会改 rig.yaw，这里每帧摆正，出门时还原
      ctx.rig.yaw = 0
      if (!state.seat && !state.tending) player.update(dt, time, wish)
      if (wish.lengthSq() > 0.01) dismiss()
      const night = ctx.weather.now.night
      document.body.classList.toggle('is-night', night > 0.5)
      ctx.renderer.toneMappingExposure = 1.05 + 0.2 * night
      room.frame(ctx.camera, dt, time, night)
      things.update(ctx.camera, player.position, time, innerWidth, innerHeight)
      ctx.renderer.render(room.scene, ctx.camera)
      const stride = Math.floor(player.state.stride / Math.PI)
      if (stride !== state.steps && player.state.moving) ctx.audio.step()
      state.steps = stride
    },
  }
}
