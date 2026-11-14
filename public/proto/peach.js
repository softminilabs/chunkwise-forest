// 盆栽桃花的样张：从种子到开花五个样子并排摆在五只花盆里。
// ?night 看夜里；?from=x,y,z&to=x,y,z 换镜头（看某一盆的特写）
import { at } from '../src/look.js'
import { peach } from '../src/world/plants/peach.js'
import { createStage, standInPot } from './plant-stage.js'

const params = new URLSearchParams(location.search)
const spot = (name, fallback) => params.get(name)?.split(',').map(Number) ?? fallback
const stage = createStage({ from: spot('from', [0, 2, 7.8]), to: spot('to', [0, 0.8, 0]) })
const plants = [0, 1, 2, 3, 4].map(k => {
  const pot = at(standInPot(), (k - 2) * 1.5, 0, 0)
  const plant = at(peach.build(k), 0, 0.40, 0)
  pot.add(plant)
  stage.scene.add(pot)
  return plant
})
stage.start((dt, time) => plants.forEach(plant => peach.sway(plant, time)))
