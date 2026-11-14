// 森林里的环境声，放在 public/sounds/，不进仓库。来源有两处：旁边的眠静 Lull 项目（自然类的大多来自开源项目 Moodist），
// 和本机下载的那套 Moodist 声音库（眠静没收的几种）。
// 许可还没逐条核对，公开上线前要核：Moodist 的声音一部分是 CC0、一部分是 Pixabay 的许可；溪水来自 Ambie；蝉鸣在眠静里没登记来源
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const LULL = '../Lull/Lull/Resources/Sounds'
const MOODIST = `${homedir()}/Documents/Sounds`
const OUT = 'public/sounds'
const FILES = ['morning_birds.mp3', 'pond_frogs.mp3', 'summer_crickets.mp3', 'bamboo_wind.mp3', 'winter_wind.mp3', 'rain_forest.mp3', 'thunderstorm.mp3', 'campfire.mp3', 'cicada.mp3']
// 眠静没收的几种：[声音库里的文件, 拷过来叫什么]
const EXTRA = [['animals/owl.mp3', 'owl.mp3'], ['rain/light-rain.mp3', 'light_rain.mp3'], ['rain/rain-on-window.mp3', 'rain_window.mp3']]

if (!existsSync(LULL)) throw new Error(`没找到眠静的声音：${LULL}`)
if (!existsSync(MOODIST)) throw new Error(`没找到 Moodist 的声音库：${MOODIST}`)
mkdirSync(OUT, { recursive: true })
for (const name of FILES) cpSync(`${LULL}/${name}`, `${OUT}/${name}`)
for (const [from, name] of EXTRA) cpSync(`${MOODIST}/${from}`, `${OUT}/${name}`)
// 溪水是 4MB 的 wav，转成 AAC 小很多
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', `${LULL}/stream.wav`, `${OUT}/stream.m4a`])
console.log(`环境声：${FILES.length + EXTRA.length + 1} 个`)
