// 小镇里所有东西的做法：圆滚滚的几何体 + 两三档明暗的卡通材质 + 外面一圈白边（贴纸的模切边）。
// 白边是把同一个几何体沿法线撑大一圈、只画背面，所以几何体的法线必须是连续的：
// 用圆角盒子、胶囊、旋转体，别用带硬棱的 BoxGeometry / CylinderGeometry，不然白边会在棱上裂开
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const shades = new THREE.DataTexture(new Uint8Array([168, 222, 255]), 3, 1, THREE.RedFormat)
shades.minFilter = shades.magFilter = THREE.NearestFilter
shades.needsUpdate = true

const toons = new Map()
const outlines = new Map()
const flats = []

export function paint(color) {
  if (!toons.has(color)) toons.set(color, new THREE.MeshToonMaterial({ color, gradientMap: shades }))
  return toons.get(color)
}

/// 不受光照的纯色（地面、贴花）。夜里靠 tintFlats 整体压暗；glow 的不压，天黑了它就显得亮
export function flat(color, { glow = false, ...options } = {}) {
  const material = new THREE.MeshBasicMaterial({ color, ...options })
  if (!glow) flats.push({ material, base: new THREE.Color(color) })
  return material
}

function outlineMaterial(width) {
  if (outlines.has(width)) return outlines.get(width)
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${width.toFixed(3)};`)
  }
  material.customProgramCacheKey = () => `outline-${width}`
  outlines.set(width, material)
  return material
}

export function tintFlats(tint) { for (const item of flats) item.material.color.copy(item.base).multiply(tint) }
export function tintOutlines(color) { for (const material of outlines.values()) material.color.copy(color) }

export function toy(geometry, color, { outline = 0.1, cast = true, material } = {}) {
  const mesh = new THREE.Mesh(geometry, material ?? paint(color))
  mesh.castShadow = cast
  if (outline) mesh.add(new THREE.Mesh(geometry, outlineMaterial(outline)))
  return mesh
}

export function at(object, x = 0, y = 0, z = 0) { object.position.set(x, y, z); return object }
export function group(...children) { const node = new THREE.Group(); node.add(...children); return node }

export function ball(radius, squash = 1) {
  const geometry = new THREE.SphereGeometry(radius, 22, 14)
  if (squash !== 1) geometry.scale(1, squash, 1)
  return geometry
}
export const box = (w, h, d, radius = 0.25) => new RoundedBoxGeometry(w, h, d, 4, Math.min(radius, w / 2, h / 2, d / 2))
export const pill = (radius, length) => new THREE.CapsuleGeometry(radius, length, 6, 14)

/// 上下带圆角的圆台，底面中心在原点；top 给 0 就是圆锥。sides 给 4 是四棱台
export function drum(top, bottom, height, bevel = 0.12, sides = 24) {
  const points = [new THREE.Vector2(0, 0)]
  const arc = (cx, cy, r, from, to) => {
    for (let i = 0; i <= 5; i++) {
      const a = from + (to - from) * i / 5
      points.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r))
    }
  }
  const low = Math.min(bevel, bottom * 0.9)
  const high = Math.min(bevel, top * 0.9)
  arc(bottom - low, low, low, -Math.PI / 2, 0)
  if (high > 0) arc(top - high, height - high, high, 0, Math.PI / 2)
  points.push(new THREE.Vector2(0, height))
  return new THREE.LatheGeometry(points, sides)
}

/// 画在画布上的贴图：招牌、表盘、灯牌
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  draw(context, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export const polar = (degrees, radius) => {
  const a = degrees * Math.PI / 180
  return { x: Math.sin(a) * radius, z: -Math.cos(a) * radius }
}
