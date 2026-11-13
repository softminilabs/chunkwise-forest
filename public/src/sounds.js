// 森林里的环境声。文件是眠静 Lull 里的（npm run sounds 拷过来）。默认「自动」：什么季节、白天还是夜里、
// 下没下雨、离篝火和小溪多远，决定这会儿该有哪些声音、各多响；每一种也可以手动常开或关掉
import { smooth } from './look.js'
import { STREAM, distanceTo } from './world/land.js'

export const SOUNDS = {
  birds: ['晨鸟', 'morning_birds.mp3'], stream: ['溪水', 'stream.m4a'], leaves: ['林间的风', 'bamboo_wind.mp3'], wind: ['冬天的风', 'winter_wind.mp3'],
  crickets: ['蟋蟀', 'summer_crickets.mp3'], frogs: ['蛙鸣', 'pond_frogs.mp3'], rain: ['雨打树叶', 'rain_forest.mp3'], thunder: ['雷雨', 'thunderstorm.mp3'], fire: ['篝火', 'campfire.mp3'],
}
const ON_LEVEL = 0.55

/// 「自动」时每种声音多响（0–1）
function natural(scene, camp, player) {
  const { season, night, weather } = scene
  const dry = weather === 'rain' ? 0 : 1
  const by = table => table[season] ?? 0
  return {
    birds: (1 - night) * dry * by({ spring: 0.6, summer: 0.35, autumn: 0.25, winter: 0.08 }),
    crickets: night * dry * by({ spring: 0.15, summer: 0.6, autumn: 0.3 }),
    frogs: night * by({ spring: 0.5, summer: 0.25 }),
    leaves: by({ spring: 0.2, summer: 0.2, autumn: 0.5 }),
    wind: by({ winter: 0.5 }),
    rain: weather === 'rain' ? 0.7 : 0,
    thunder: weather === 'rain' && season === 'summer' ? 0.4 : 0,
    fire: camp.heat * (0.25 + 0.75 * (1 - smooth(4, 34, Math.hypot(player.x - camp.x, player.z - camp.z)))),
    stream: by({ spring: 0.6, summer: 0.6, autumn: 0.6, winter: 0.3 }) * (1 - smooth(3, 28, distanceTo(STREAM, player.x, player.z))),
  }
}

export function createSounds(audio, state) {
  const voices = {}
  const levels = {}

  /// 用到了才去取这个文件；取回来之前先占个位，免得一帧里重复取
  function voice(id) {
    if (voices[id] || !audio.context) return voices[id]
    const context = audio.context
    const gain = context.createGain()
    gain.gain.value = 0
    gain.connect(audio.out)
    voices[id] = { gain, level: 0 }
    fetch(`sounds/${SOUNDS[id][1]}`).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data)).then(buffer => {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      source.start()
    }).catch(() => {})
    return voices[id]
  }

  return {
    levels,
    update(scene, camp, player) {
      const auto = natural(scene, camp, player)
      for (const id of Object.keys(SOUNDS)) {
        const mode = state.town.mix[id] ?? 'auto'
        const level = (mode === 'off' ? 0 : mode === 'on' ? ON_LEVEL : auto[id]) * state.town.volume
        levels[id] = level
        if (level < 0.01 && !voices[id]) continue
        const item = voice(id)
        // 音量变了才去改：每帧都排一条渐变，声音引擎里会越积越多
        if (!item || Math.abs(item.level - level) < 0.015) continue
        item.level = level
        item.gain.gain.setTargetAtTime(level, audio.context.currentTime, 0.7)
      }
    },
  }
}
