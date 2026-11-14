// 给一棵植物拍张小照片：选种子的卡片上那五个样子、荣誉墙上长成的那张，都是屋里那棵的真模型拍的
import * as THREE from 'three'
import { at } from '../look.js'
import { createPot } from './pot.js'

// 每个样子拍它在这个阶段「长到头」的大小
const FULL = [0, 0.199, 0.499, 0.999, 1]
const SIZE = [320, 400]
const shots = new Map()
let studio = null

/// 一间只拍照用的小棚子：自己的画布、自己的一只花盆（不带水壶）。底是透明的，照片贴到什么颜色上都行
function open() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(...SIZE, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, SIZE[0] / SIZE[1], 0.1, 50)
  camera.position.set(1.5, 1.7, 4.9)
  camera.lookAt(0, 0.98, 0)
  const pot = createPot()
  pot.can.visible = false
  scene.add(pot.group, new THREE.HemisphereLight('#FFF3DF', '#7A6450', 1.35), at(new THREE.DirectionalLight('#FFF1D6', 1.7), -3, 6, 5), at(new THREE.DirectionalLight('#FFE9CF', 0.5), 4, 3, 2))
  return { renderer, scene, camera, pot }
}

/// 返回一张画布。同一个样子只拍一次，别在上面画东西
export function portrait(plant, stage) {
  const key = `${plant.id}:${stage}`
  if (!shots.has(key)) {
    studio ??= open()
    studio.pot.plant(plant, FULL[stage])
    studio.renderer.render(studio.scene, studio.camera)
    const shot = document.createElement('canvas')
    shot.width = SIZE[0]
    shot.height = SIZE[1]
    shot.getContext('2d').drawImage(studio.renderer.domElement, 0, 0)
    shots.set(key, shot)
  }
  return shots.get(key)
}
