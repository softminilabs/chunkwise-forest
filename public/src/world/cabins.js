// 九间木屋 = B1 的九个单元，外加空地旁的单词屋。读过课的屋子才「有人住」：夜里窗户亮、烟囱冒烟；
// 屋檐下挂十盏小灯，一课一盏
import * as THREE from 'three'
import { at, mat, shade } from '../look.js'
import { CABINS, CLEARING, LODGE, height } from './land.js'

const WALLS = ['#A77F5C', '#B48A62', '#9C7654']
const ROOFS = ['#4E6E66', '#7A4B3E', '#5B6B86', '#6B5A3E']
const SNOW = '#F4F8FA'
const LAMP = { off: '#77736A', one: '#FFD27A', two: '#FFF0B8' }

function build({ wide, tall, wall, roof }) {
  const root = new THREE.Group()
  const pane = new THREE.MeshStandardMaterial({ color: '#DCE9EC', emissive: '#FFB84D', emissiveIntensity: 0, roughness: 0.6 })
  const top = mat(roof)
  root.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(wide, tall, 4.4), mat(wall)), 0, tall / 2, 0)))
  for (let k = 1; k < 5; k++) root.add(at(new THREE.Mesh(new THREE.BoxGeometry(wide + 0.06, 0.05, 4.46), mat('#8B6648')), 0, k * tall / 5, 0))
  // 屋顶是一个放倒的三棱柱
  const pitch = new THREE.CylinderGeometry(1.5, 1.5, 5.2, 3)
  pitch.rotateX(-Math.PI / 2)
  pitch.scale((wide / 2 + 0.55) / 1.3, 0.82, 1)
  root.add(shade(at(new THREE.Mesh(pitch, top), 0, tall + 0.6, 0)))
  // 冬天屋顶盖着雪，檐口露出一条原来的颜色
  const eave = at(new THREE.Mesh(pitch, mat(roof)), 0, tall + 0.46, 0)
  eave.scale.set(1.02, 0.9, 1.02)
  eave.visible = false
  root.add(eave)
  root.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.14), mat('#5B4334')), 0, 0.95, 2.22))
  for (const side of [-1, 1]) root.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.12), pane), side * (wide / 2 - 1.15), 1.75, 2.22))
  root.add(shade(at(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat('#8E8B86')), wide / 2 - 1.1, tall + 1.6, -0.9)))
  root.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.1), mat('#8B6648')), 0, 0.11, 2.75))
  const smoke = [0, 1, 2].map(k => at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 + k * 0.16, 1), new THREE.MeshStandardMaterial({ color: '#E9EEF0', transparent: true, opacity: 0, roughness: 1 })), wide / 2 - 1.1, tall + 3, -0.9))
  const lamps = Array.from({ length: 10 }, (_, k) => at(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: LAMP.off, emissive: '#FFB03A', emissiveIntensity: 0, roughness: 0.7 })), (k / 9 - 0.5) * (wide - 1), tall - 0.22, 2.3))
  const glow = at(new THREE.PointLight('#FFB866', 0, 16, 2), 0, 1.9, 3.4)
  root.add(...smoke, ...lamps, glow)
  return { root, pane, top, roof, eave, smoke, lamps, glow, chimney: { x: wide / 2 - 1.1, y: tall + 3 } }
}

function place(made, x, z, turn) {
  made.root.position.set(x, height(x, z), z)
  made.root.rotation.y = turn
  return { ...made, x, z, y: made.root.position.y, doorAt: { x: x + Math.sin(turn) * 4.3, z: z + Math.cos(turn) * 4.3 }, lit: false }
}

export function createCabins(scene, course, colliders) {
  // 门斜着朝向小路，也半朝着南边的镜头
  const houses = course.units.map((unit, k) => ({ unit, height: 6.6, ...place(build({ wide: 5.4 + (k % 3) * 0.3, tall: 2.9, wall: WALLS[k % 3], roof: ROOFS[k % 4] }), CABINS[k].x, CABINS[k].z, -CABINS[k].side * (Math.PI / 2 - 0.5)) }))
  const lodge = { height: 7.4, ...place(build({ wide: 6.8, tall: 3.4, wall: '#B48A62', roof: '#7A4B3E' }), LODGE.x, LODGE.z, Math.atan2(CLEARING.x - LODGE.x, CLEARING.z + 14 - LODGE.z)) }
  lodge.lit = true
  const all = [...houses, lodge]
  for (const cabin of all) { scene.add(cabin.root); colliders.push({ x: cabin.x, z: cabin.z, r: 3.7 }) }

  return {
    houses, lodge,
    /// stars：{ 课 id: 星数 }。有一课读过，这间屋就算有人住了
    setProgress(stars) {
      for (const house of houses) {
        house.lit = house.unit.lessons.some(lesson => stars[lesson.id])
        house.unit.lessons.forEach((lesson, k) => {
          const count = stars[lesson.id] ?? 0
          const lamp = house.lamps[k]
          lamp.material.color.set(count >= 2 ? LAMP.two : count ? LAMP.one : LAMP.off)
          lamp.material.emissiveIntensity = count >= 2 ? 2.4 : count ? 1.4 : 0
          lamp.userData.size = count >= 2 ? 1.35 : 1
          lamp.scale.setScalar(lamp.userData.size)
        })
      }
    },
    /// 刚点亮的那盏灯弹一下
    pop(lessonId) {
      for (const house of houses) { const k = house.unit.lessons.findIndex(lesson => lesson.id === lessonId); if (k >= 0) { house.lamps[k].userData.pop = 1; return { house, lamp: house.lamps[k] } } }
      return null
    },
    paint(season) {
      for (const cabin of all) { cabin.top.color.set(season === 'winter' ? SNOW : cabin.roof); cabin.eave.visible = season === 'winter' }
    },
    update(night, dt, time) {
      for (const cabin of all) {
        const on = cabin.lit ? 1 : 0
        cabin.pane.emissiveIntensity = on * (0.15 + night * 2.1)
        cabin.pane.color.set(on && night > 0.4 ? '#FFD98A' : '#DCE9EC')
        cabin.glow.intensity = on * night * 26
        cabin.smoke.forEach((puff, k) => {
          const t = (time * 0.22 + k / 3) % 1
          puff.position.set(cabin.chimney.x + t * 1.1, cabin.chimney.y + t * 2.8, -0.9)
          puff.material.opacity = on * (1 - t) * 0.7
        })
        for (const lamp of cabin.lamps) {
          if (!(lamp.userData.pop > 0)) continue
          lamp.userData.pop -= dt * 1.1
          lamp.scale.setScalar((lamp.userData.size ?? 1) * (1 + Math.sin(Math.max(0, lamp.userData.pop) * Math.PI) * 1.8))
        }
      }
    },
  }
}
