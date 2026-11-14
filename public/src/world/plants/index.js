// 花盆里能种的几种。每一种：id、drops（一共要几滴水）、build(stage)、sway(group, time)
import { t } from '../../i18n.js'
import { peach } from './peach.js'
import { pine } from './pine.js'

export const PLANTS = { pine, peach }
/// 打算做、模型还没做的几种：选种子的卡片上先摆出来，告诉人以后会有。按滴数从少到多
export const PLANNED = [
  { id: 'toadstool', drops: 12 }, { id: 'sunflower', drops: 20 }, { id: 'glowcap', drops: 30 },
  { id: 'plum', drops: 45 }, { id: 'maple', drops: 50 }, { id: 'bamboo', drops: 60 },
]
const NAMES = {
  pine: t('松树'), peach: t('桃花'),
  toadstool: t('红蘑菇'), sunflower: t('向日葵'), glowcap: t('夜光蘑菇'), plum: t('梅花'), maple: t('枫树'), bamboo: t('竹子'),
}
export const plantName = id => NAMES[id]
