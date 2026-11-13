// 单词屋：屋里是另一个场景（world/room.js），用的是同一台镜头、同一套按键。
// 这里管进出、在屋里走动、屋里几样东西各开什么：书桌 = 今天的词，书架 = 词库，留声机 = 听单词，门 = 回森林
import * as THREE from 'three'
import { h } from './core.js'
import { t } from '../i18n.js'
import { createPlayer } from '../player.js'
import { createThings } from '../things.js'
import { PLACES, ROOM_COLLIDERS, ROOM_GROUND, SEATS, createRoom } from '../world/room.js'
import { loadIndex, loadLevel, wordsOf } from '../words/deck.js'
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
  const state = { inside: false, seat: null, busy: false, ready: 0, yaw: 0, steps: 0, leaveSeat: null, done: null, fading: null }
  const things = createThings(document.getElementById('room-tags'), { onChoose: thing => approach(thing), chrome: '.room-hud > *' })
  const add = (key, thing) => things.add({ kind: 'house', ...PLACES[key], position: new THREE.Vector3(...PLACES[key].position), ...thing })
  const desk = add('desk', { title: t('今天的词'), badge: t('词'), use: () => sit('desk', openDesk) })
  add('shelf', { title: t('词库'), badge: t('书'), use: openShelf })
  add('gramophone', { title: t('听单词'), badge: t('听'), use: () => listenHere() })
  add('door', { title: t('回森林'), badge: t('门'), use: leave })
  hud.append(h('button', { class: 'pill', type: 'button', onclick: leave }, t('← 回森林')), h('div', { class: 'brand sticker' }, h('strong', {}, t('单词屋')), brand))

  /// 今天还有几个要复习、几个新词可学。屋外的牌子、屋里书桌的牌子、顶栏上那行字都用它
  async function plan() {
    const { progress } = ctx.words
    const left = Math.max(0, progress.store.daily - progress.newToday())
    return { due: progress.due().length, fresh: progress.newWords(await loadLevel(progress.store.level), left).length, learned: progress.learned() }
  }

  async function paint() {
    const now = await plan()
    desk.hint = now.due || now.fresh ? [now.due && t('复习 {n} 个', { n: now.due }), now.fresh && t('新词 {n} 个', { n: now.fresh })].filter(Boolean).join(' · ') : t('今天的学完了')
    things.refresh(desk)
    brand.textContent = t('在学 {level} · 学过 {n} 个', { level: ctx.words.progress.store.level, n: now.learned.length })
    // 板上钉最近学会的十五个词；书架按在学的这一级学过几成上色
    room.setNotes((await wordsOf(now.learned.slice(0, 15))).map(word => word.w))
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

  function enter() {
    if (state.inside) return
    paint()
    return swap(() => {
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
  }

  function leave() {
    if (!state.inside || state.seat) return
    dismiss()
    return swap(() => {
      state.inside = false
      ctx.rig.yaw = state.yaw
      document.body.classList.remove('is-inside', 'is-night')
    })
  }

  /// 学完一轮回到屋里，底下出一条结果；一走动、一用东西就收起来
  function report(result) {
    dismiss()
    if (!result) return
    state.done = h('div', { class: 'room-done sticker' },
      h('div', {}, h('strong', {}, t('这一轮 {n} 个词学完了', { n: result.count })),
        h('small', {}, [t('第一次就记得的 {p}%', { p: result.firstTry }), t('明天有 {n} 个该复习', { n: ctx.words.progress.dueTomorrow() })].join(' · '))),
      h('button', { class: 'button plain', type: 'button', onclick: () => sit('desk', openDesk) }, t('接着学')),
      h('button', { class: 'button', type: 'button', onclick: leave }, t('回森林')))
    document.body.append(state.done)
  }
  function dismiss() { state.done?.remove(); state.done = null }

  /// 坐下：镜头推过去，#seat 里的内容交给 open 去搭。open 返回「起身时要收拾什么」
  function sit(kind, open, options) {
    if (state.seat) return
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
      h('header', { class: 'reader-head' }, h('div', { class: 'grow' }, h('h2', {}, t('听单词'))), h('button', { class: 'close', type: 'button', 'aria-label': t('关上'), onclick: () => ctx.ui.closeModal() }, '✕')),
      listen.node), () => listen.stop())
    listen.start()
  }

  function approach(thing) {
    if (state.seat || ctx.ui.busy || performance.now() < state.ready) return
    dismiss()
    player.goTo(thing.spot[0], thing.spot[1], 0.35, () => thing.use())
  }

  ctx.words.progress.on(paint)
  return {
    enter, leave, plan, listenOutside,
    get inside() { return state.inside },
    get seated() { return Boolean(state.seat) },
    use() { const thing = things.nearest(player.position); if (thing && !state.seat && performance.now() > state.ready) { dismiss(); thing.use() } },
    escape() { if (state.seat) stand(); else ctx.ui.escape() },
    hover: ray => things.hover(ray),
    pick(ray) { const thing = things.pick(ray); if (thing) approach(thing); return Boolean(thing) },
    ground(point) { dismiss(); player.goTo(point.x, point.z) },
    frame(dt, time, wish) {
      // 在屋里镜头不转：按键的方向以正对后墙为准。拖动会改 rig.yaw，这里每帧摆正，出门时还原
      ctx.rig.yaw = 0
      if (!state.seat) player.update(dt, time, wish)
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
