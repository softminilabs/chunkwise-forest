// 盆栽松树的样张：五个样子并排摆在五只临时花盆里。
// ?at=0..4 用屋里浇水时的镜头凑近看其中一棵；?top 从上往下 45° 看（屋里平时的角度）；?night 夜里的光
import * as THREE from 'three'
import { at } from '../src/look.js'
import { pine } from '../src/world/plants/pine.js'
import { createStage, standInPot } from './plant-stage.js'

const params = new URLSearchParams(location.search)
const GAP = 1.4
const SOIL = 0.40
const stage = createStage()

/// 临时花盆的盆身是实心的，顶盖在 0.44，把 0.40 的土面和植物最下面四厘米全盖住了：种子、根脚都看不见。
/// 这里把盆身换成不带盖的，再垫一圈土把土面和盆壁之间的缝补上
function pot() {
  const group = standInPot()
  const [body, soil] = group.children
  body.geometry.dispose()
  body.geometry = new THREE.CylinderGeometry(0.36, 0.25, 0.44, 14, 1, true)
  body.material = body.material.clone()
  body.material.side = THREE.DoubleSide
  group.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 14), soil.material), 0, 0.395, 0))
  soil.receiveShadow = group.children[2].receiveShadow = true
  return group
}

const plants = [0, 1, 2, 3, 4].map(k => {
  const plant = at(pine.build(k), (k - 2) * GAP, SOIL, 0)
  stage.scene.add(at(pot(), (k - 2) * GAP, 0, 0), plant)
  return plant
})

/// 把镜头挪到 from、看 to。截图脚本也用它
function look(from, to) {
  stage.camera.position.set(...from)
  stage.camera.lookAt(...to)
}
if (params.has('at')) { const x = (Number(params.get('at')) - 2) * GAP; look([x + 0.9, 2.0, 3.85], [x, 1.0, 0]) }
if (params.has('top')) look([0, 8.2, 7.6], [0, 0.6, 0])

/// 每个样子有多高（土面以上）、离中轴最远伸到哪儿、多少个三角面。实例化的网格每一份都算
function measure() {
  const spot = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  return plants.map(plant => {
    const size = { tall: 0, reach: 0, faces: 0 }
    plant.updateWorldMatrix(true, true)
    plant.traverse(node => {
      if (!node.isMesh) return
      const points = node.geometry.attributes.position
      size.faces += (node.geometry.index ?? points).count / 3 * (node.count ?? 1)
      for (let k = 0; k < (node.count ?? 1); k++) {
        matrix.copy(node.matrixWorld)
        if (node.isInstancedMesh) { node.getMatrixAt(k, matrix); matrix.premultiply(node.matrixWorld) }
        for (let i = 0; i < points.count; i++) {
          spot.fromBufferAttribute(points, i).applyMatrix4(matrix).sub(plant.position)
          size.tall = Math.max(size.tall, spot.y)
          size.reach = Math.max(size.reach, Math.hypot(spot.x, spot.z))
        }
      }
    })
    return { tall: +size.tall.toFixed(3), reach: +size.reach.toFixed(3), faces: size.faces }
  })
}
Object.assign(window, { look, measure })

stage.start((dt, time) => { for (const plant of plants) pine.sway(plant, time) })
