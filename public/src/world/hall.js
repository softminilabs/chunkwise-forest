// 讲堂：篝火空地西边的一座长屋。屋脊靠门那头顶着小钟楼，山墙上挂着钟，门边立一块黑板。
// 点它打开讲语法的那一页（ui/hall.js）
import * as THREE from 'three'
import { at, mat, shade } from '../look.js'
import { CLEARING, HALL, height } from './land.js'

const WIDE = 4.4
const LONG = 7.2
// 石头地基露出地面多高。讲堂盖在缓坡上，屋后的地比门口低半米，靠地基垫平
const FLOOR = 0.3
const WALL = 2.9
const RISE = 1.9
const EAVE = FLOOR + WALL
const RIDGE = EAVE + RISE
const FRONT = LONG / 2
// 屋顶比墙多挑出去多少
const OVER = 0.4
// 钟楼在屋身中心往门那头多远：座子的正面和山墙齐平
const BELFRY = FRONT - 0.63
// 黑板架立在门的南侧、离墙角一步远：再贴近，它的碰撞圆就和屋身的连成一道死角，
// 沿着南墙绕去门口的人会卡在里面
const BOARD = { x: -3.2, z: FRONT + 1.8 }
const SNOW = '#F4F8FA'

const box = (wide, tall, deep, x, y, z) => new THREE.BoxGeometry(wide, tall, deep).translate(x, y, z)
/// 山墙上头的三角：尖朝上，底边在 y = 0，厚度顺着 z
const gable = (half, rise, deep) => new THREE.CylinderGeometry(1, 1, deep, 3).rotateX(-Math.PI / 2).scale(half / Math.sqrt(0.75), rise / 1.5, 1).translate(0, rise / 3, 0)

/// 人字顶的两片坡面，屋脊顺着 z。half：檐口离中线多远；rise：屋脊比檐口高多少；y：檐口多高
function slopes(half, rise, long, thick, y, z) {
  const pitch = Math.atan2(rise, half)
  return [-1, 1].map(side => new THREE.BoxGeometry(Math.hypot(half, rise), thick, long).rotateZ(-side * pitch)
    .translate(side * (half + Math.sin(pitch) * thick) / 2, y + (rise + Math.cos(pitch) * thick) / 2, z))
}

/// 同一种材质的零件并成一块：整座屋一百多个小零件，一种材质只画一次
function pile(material, parts) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(parts.flatMap(part => [...(part.index ? part.toNonIndexed() : part).attributes.position.array]), 3))
  // 平涂用不着法线，可接影子时的偏移要用
  geometry.computeVertexNormals()
  return shade(new THREE.Mesh(geometry, material))
}

function walls(parts) {
  parts.stone.push(box(WIDE + 0.4, 1.8, LONG + 0.4, 0, FLOOR - 0.9, 0))
  parts.wall.push(box(WIDE, WALL, LONG, 0, FLOOR + WALL / 2, 0), gable(WIDE / 2, RISE, LONG).translate(0, EAVE, 0))
  parts.timber.push(box(WIDE + 0.14, 0.2, LONG + 0.14, 0, FLOOR + 0.1, 0))
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) parts.timber.push(box(0.24, WALL, 0.24, side * (WIDE / 2 - 0.05), FLOOR + WALL / 2, end * (FRONT - 0.05)))
    // 长墙上每两扇窗之间一根立柱
    for (const z of [-1.7, 0, 1.7]) parts.timber.push(box(0.1, WALL, 0.12, side * WIDE / 2, FLOOR + WALL / 2, z))
    // 山墙齐檐口的一道横梁
    parts.timber.push(box(WIDE + 0.14, 0.18, 0.1, 0, EAVE, side * (FRONT + 0.01)))
  }
}

function roof(parts) {
  const half = WIDE / 2 + OVER
  const rise = RISE * half / (WIDE / 2)
  const long = LONG + OVER * 2
  /// 一层屋面：inset 是四边各收进多少，lift 是整层垫高多少
  const cover = (inset, thick, lift) => slopes(half - inset, rise * (half - inset) / half, long - inset * 2, thick, RIDGE + lift - rise * (half - inset) / half, 0)
  // 两片坡面在屋脊上合不拢，压一条脊瓦盖住那道缝
  parts.roof.push(...cover(0, 0.14, 0), box(0.36, 0.12, long, 0, RIDGE + 0.13, 0))
  // 山墙两头的封檐板：比屋面板厚，把板头包住。两块在尖上也合不拢，钉一块菱形的板挡住
  for (const end of [-1, 1]) parts.trim.push(...slopes(half, rise, 0.1, 0.36, RIDGE - rise - 0.26, end * (long / 2 - 0.02)), box(0.34, 0.34, 0.12, 0, 0, 0).rotateZ(Math.PI / 4).translate(0, RIDGE - 0.02, end * (long / 2 - 0.02)))
  // 雪压在屋面板上（0.14 厚的板斜着铺，竖着量是 0.19），比屋面小一圈：檐口露出一条屋顶本来的颜色，和木屋一个样子
  parts.snow.push(...cover(0.12, 0.13, 0.19), box(0.5, 0.14, long - 0.24, 0, RIDGE + 0.3, 0))
}

function belfry(parts) {
  // 钟架立在屋脊上头这么高的地方，底下是一截实心的座子
  const up = RIDGE + 0.65
  parts.wall.push(box(1.3, 1.15, 1.3, 0, up - 0.675, BELFRY))
  parts.trim.push(box(1.5, 0.1, 1.5, 0, up - 0.05, BELFRY), box(1.34, 0.12, 1.34, 0, up + 0.81, BELFRY))
  for (const x of [-0.55, 0.55]) for (const z of [-0.55, 0.55]) parts.trim.push(box(0.14, 0.75, 0.14, x, up + 0.375, BELFRY + z))
  parts.roof.push(new THREE.ConeGeometry(1.1, 1.15, 4).rotateY(Math.PI / 4).translate(0, up + 1.445, BELFRY))
  // 雪帽比塔尖鼓出来一点点：一样大的话和塔尖贴在一起，看不见
  parts.snow.push(new THREE.ConeGeometry(0.7, 0.72, 4).rotateY(Math.PI / 4).translate(0, up + 1.72, BELFRY))
  parts.brass.push(
    new THREE.CylinderGeometry(0.13, 0.3, 0.4, 8).translate(0, up + 0.38, BELFRY),
    new THREE.CylinderGeometry(0.3, 0.36, 0.08, 8).translate(0, up + 0.14, BELFRY),
    box(0.06, 0.2, 0.06, 0, up + 0.66, BELFRY),
    new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5).translate(0, up + 2.14, BELFRY),
    new THREE.IcosahedronGeometry(0.09, 0).translate(0, up + 2.34, BELFRY))
  parts.dark.push(new THREE.IcosahedronGeometry(0.07, 0).translate(0, up + 0.07, BELFRY))
}

/// 一扇圆拱顶的高窗，窗棂分成六格。先朝 +z 搭好，再转到墙上
function sash(parts, x, z, turn) {
  const put = geometry => geometry.rotateY(turn).translate(x, FLOOR + 0.65, z)
  const arch = (radius, deep) => new THREE.CylinderGeometry(radius, radius, deep, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).translate(0, 1.25, 0)
  parts.trim.push(...[box(0.96, 1.25, 0.1, 0, 0.625, 0), arch(0.48, 0.1), box(1.12, 0.08, 0.22, 0, -0.04, 0.05), box(0.06, 1.6, 0.16, 0, 0.8, 0), box(0.76, 0.06, 0.16, 0, 0.45, 0), box(0.76, 0.06, 0.16, 0, 0.9, 0)].map(put))
  parts.pane.push(...[box(0.76, 1.2, 0.13, 0, 0.65, 0), arch(0.38, 0.13)].map(put))
}

function windows(parts) {
  for (const z of [-2.55, -0.85, 0.85, 2.55]) for (const side of [-1, 1]) sash(parts, side * (WIDE / 2 + 0.03), z, side * Math.PI / 2)
  sash(parts, 0, -FRONT - 0.03, Math.PI)
}

/// 对开的门，门头上一条亮子；山墙上一面钟，指着九点
function entrance(parts) {
  parts.trim.push(box(1.56, 2.5, 0.1, 0, FLOOR + 1.25, FRONT + 0.02), box(0.06, 0.34, 0.14, 0, FLOOR + 2.24, FRONT + 0.04))
  parts.pane.push(box(1.36, 0.3, 0.1, 0, FLOOR + 2.24, FRONT + 0.04))
  for (const side of [-1, 1]) {
    parts.dark.push(box(0.66, 2, 0.1, side * 0.35, FLOOR + 1, FRONT + 0.06))
    parts.brass.push(box(0.07, 0.07, 0.07, side * 0.1, FLOOR + 1, FRONT + 0.13))
  }
  // 钟不能再大、再高：再往上山墙收窄，钟的边就被封檐板压住了
  const y = EAVE + 0.9
  const disc = (radius, deep, z) => new THREE.CylinderGeometry(radius, radius, deep, 14).rotateX(Math.PI / 2).translate(0, y, FRONT + z)
  parts.dark.push(disc(0.5, 0.08, 0.03), box(0.05, 0.34, 0.04, 0, y + 0.14, FRONT + 0.12), box(0.24, 0.06, 0.04, -0.1, y, FRONT + 0.12))
  parts.trim.push(disc(0.41, 0.1, 0.05))
}

/// 门廊：一块石台、一级台阶、两根柱子顶着一个小人字顶，顶下挂一盏灯。
/// 做得浅：从开场的镜头看，门廊是整座屋最靠右的一角，再往外伸就挨上灯笼树了
function porch(parts) {
  parts.stone.push(box(2.3, 1.5, 1.15, 0, FLOOR - 0.75, FRONT + 0.575), box(1.6, 1.2, 0.36, 0, FLOOR - 0.75, FRONT + 1.33))
  for (const side of [-1, 1]) parts.trim.push(box(0.16, 2.2, 0.16, side * 0.95, FLOOR + 1.1, FRONT + 0.98))
  parts.trim.push(box(2.2, 0.14, 0.16, 0, FLOOR + 2.23, FRONT + 0.98))
  parts.wall.push(gable(1.1, 0.55, 0.08).translate(0, FLOOR + 2.3, FRONT + 0.98))
  parts.roof.push(...slopes(1.3, 0.68, 1.45, 0.1, FLOOR + 2.3, FRONT + 0.68))
  parts.snow.push(...slopes(1.2, 0.63, 1.25, 0.1, FLOOR + 2.46, FRONT + 0.7))
  parts.dark.push(box(0.26, 0.05, 0.26, 0, FLOOR + 2.11, FRONT + 0.98))
  parts.pane.push(box(0.2, 0.24, 0.2, 0, FLOOR + 1.97, FRONT + 0.98))
}

/// 门边的黑板架。先朝 +z 搭好、往后仰一点，再转过去：板面斜对着南边，从开场的镜头和走过来的人那边都看得见字
function board(parts) {
  const put = geometry => geometry.rotateX(-0.12).rotateY(-0.75).translate(BOARD.x, 0, BOARD.z)
  const pieces = {
    slate: [box(1.5, 1, 0.06, 0, 1.5, 0)],
    timber: [box(1.64, 0.08, 0.1, 0, 2.04, 0), box(1.64, 0.08, 0.1, 0, 0.96, 0), box(0.08, 1.16, 0.1, -0.78, 1.5, 0), box(0.08, 1.16, 0.1, 0.78, 1.5, 0), box(1.3, 0.05, 0.16, 0, 0.94, 0.09)],
    // 腿往地下多插一截：门前的地不是平的
    dark: [box(0.08, 2.5, 0.08, -0.6, 0.95, -0.02), box(0.08, 2.5, 0.08, 0.6, 0.95, -0.02), box(0.08, 2.3, 0.08, 0, 0, 0).rotateX(0.32).translate(0, 0.92, -0.45)],
    // 粉笔字：左边一个大写的 A，右边三行、底下一行
    chalk: [
      box(0.05, 0.44, 0.02, 0, 0, 0).rotateZ(-0.3).translate(-0.535, 1.62, 0.04), box(0.05, 0.44, 0.02, 0, 0, 0).rotateZ(0.3).translate(-0.405, 1.62, 0.04), box(0.16, 0.04, 0.02, -0.47, 1.56, 0.04),
      box(0.62, 0.045, 0.02, 0.28, 1.76, 0.04), box(0.5, 0.045, 0.02, 0.22, 1.62, 0.04), box(0.62, 0.045, 0.02, 0.28, 1.48, 0.04), box(1.2, 0.045, 0.02, 0, 1.2, 0.04)],
    snow: [box(1.68, 0.1, 0.2, 0, 2.12, 0)],
  }
  for (const [look, list] of Object.entries(pieces)) parts[look].push(...list.map(put))
}

export function createHall(scene, colliders) {
  // 门朝着篝火偏南三米的地方：对着空地，也半朝着南边的镜头
  const turn = Math.atan2(CLEARING.x - HALL.x, CLEARING.z + 3 - HALL.z)
  const pane = new THREE.MeshStandardMaterial({ color: '#DCE9EC', emissive: '#FFB84D', emissiveIntensity: 0, roughness: 0.6, flatShading: true })
  const brass = new THREE.MeshStandardMaterial({ color: '#D9A531', roughness: 0.45, metalness: 0.3, flatShading: true })
  const looks = { stone: mat('#9A968E'), wall: mat('#E6D4AC'), trim: mat('#F6F0E2'), timber: mat('#8B6648'), dark: mat('#5B4334'), roof: mat('#3D4B6E'), slate: mat('#2F3F3A'), chalk: mat('#F4F1EA'), snow: mat(SNOW), pane, brass }
  const parts = Object.fromEntries(Object.keys(looks).map(look => [look, []]))
  for (const build of [walls, roof, belfry, windows, entrance, porch, board]) build(parts)
  const meshes = Object.fromEntries(Object.keys(looks).map(look => [look, pile(looks[look], parts[look])]))
  meshes.snow.castShadow = false
  const glow = at(new THREE.PointLight('#FFB866', 0, 16, 2), 0, 2.2, FRONT + 2.2)
  // 模型是绕着屋身中心搭的，整个往后挪，让钟楼正好落在 HALL 上：头顶的牌子、地图上的标记都跟着钟楼走
  const body = at(new THREE.Group(), 0, 0, -BELFRY).add(...Object.values(meshes), glow)
  const y = height(HALL.x, HALL.z)
  const root = at(new THREE.Group(), HALL.x, y, HALL.z).add(body)
  root.rotation.y = turn
  scene.add(root)
  /// 屋身上的一点（x 横着、z 顺着屋脊，从屋身中心量）在森林里的位置
  const out = (x, z) => ({ x: HALL.x + x * Math.cos(turn) + (z - BELFRY) * Math.sin(turn), z: HALL.z - x * Math.sin(turn) + (z - BELFRY) * Math.cos(turn) })
  // 碰撞体是圆的，长屋一个圆罩不住：顺着屋身排三个，黑板架另算一个
  for (const z of [-2.4, 0, 2.4]) colliders.push({ ...out(0, z), r: 2.3 })
  colliders.push({ ...out(BOARD.x, BOARD.z), r: 0.5 })

  return {
    // height 是塔尖的高度：牌子挂在它上头
    x: HALL.x, z: HALL.z, y, height: RIDGE + 2.7,
    // 台阶前一步：在最前面那个碰撞圆和人的身子之外，不然人永远走不到
    doorAt: out(0, FRONT + 2.3),
    paint(season) { meshes.snow.visible = season === 'winter' },
    /// 讲堂没有「学没学过」，夜里窗一直亮着
    update(night) {
      pane.emissiveIntensity = 0.15 + night * 2.1
      pane.color.set(night > 0.4 ? '#FFD98A' : '#DCE9EC')
      glow.intensity = night * 26
    },
  }
}
