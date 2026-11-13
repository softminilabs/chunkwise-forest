// 森林里的环境声：从旁边的眠静 Lull 项目拷过来（自然类的大多来自开源项目 Moodist）。
// 放在 public/sounds/，不进仓库。溪水那条来自 Ambie，许可还没逐条核对，公开上线前要核
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'

const FROM = '../Lull/Lull/Resources/Sounds'
const OUT = 'public/sounds'
const FILES = ['morning_birds.mp3', 'pond_frogs.mp3', 'summer_crickets.mp3', 'bamboo_wind.mp3', 'winter_wind.mp3', 'rain_forest.mp3', 'thunderstorm.mp3', 'campfire.mp3']

if (!existsSync(FROM)) throw new Error(`没找到眠静的声音：${FROM}`)
mkdirSync(OUT, { recursive: true })
for (const name of FILES) cpSync(`${FROM}/${name}`, `${OUT}/${name}`)
// 溪水是 4MB 的 wav，转成 AAC 小很多
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', `${FROM}/stream.wav`, `${OUT}/stream.m4a`])
console.log(`环境声：${FILES.length + 1} 个`)
