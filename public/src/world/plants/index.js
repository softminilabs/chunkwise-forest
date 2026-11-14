// 花盆里能种的几种。每一种：id、drops（一共要几滴水）、build(stage)、sway(group, time)
import { peach } from './peach.js'
import { pine } from './pine.js'

export const PLANTS = { pine, peach }
/// 打算做、模型还没做的几种：选种子的卡片上先摆出来，告诉人以后会有。按滴数从少到多
export const PLANNED = [
  { id: 'toadstool', drops: 12 }, { id: 'sunflower', drops: 20 }, { id: 'glowcap', drops: 30 },
  { id: 'plum', drops: 45 }, { id: 'maple', drops: 50 }, { id: 'bamboo', drops: 60 },
]
