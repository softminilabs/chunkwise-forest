// 森林里的环境声。文件是眠静 Lull 里的（npm run sounds 拷过来）。默认「自动」：按下面那张搭配表来；
// 每一种也可以手动常开或关掉
import { smooth } from './look.js'
import { STREAM, distanceTo } from './world/land.js'

export const SOUNDS = {
  birds: ['晨鸟', 'morning_birds.mp3'], stream: ['溪水', 'stream.m4a'], leaves: ['林间的风', 'bamboo_wind.mp3'], wind: ['冬天的风', 'winter_wind.mp3'],
  crickets: ['蟋蟀', 'summer_crickets.mp3'], frogs: ['蛙鸣', 'pond_frogs.mp3'], rain: ['雨打树叶', 'rain_forest.mp3'], thunder: ['雷雨', 'thunderstorm.mp3'], fire: ['篝火', 'campfire.mp3'],
}
const ON_LEVEL = 0.55

// 「自动」的搭配表：每个季节，白天、夜里各有什么底声；下雨、下雪时换成另一组（鸟和虫都不叫了）。数字是音量 0–1
const MIX = {
  spring: { day: { birds: 0.6, leaves: 0.15 }, night: { frogs: 0.5, crickets: 0.12 }, rain: { rain: 0.5, frogs: 0.3 } },
  summer: { day: { birds: 0.3, leaves: 0.2 }, night: { crickets: 0.6, frogs: 0.25 }, rain: { rain: 0.7, thunder: 0.4 } },
  autumn: { day: { leaves: 0.5, birds: 0.2 }, night: { crickets: 0.28, leaves: 0.3 }, rain: { rain: 0.6, leaves: 0.2 } },
  winter: { day: { wind: 0.4 }, night: { wind: 0.55 }, snow: { wind: 0.3 } },
}
// 小溪四季都在流，冬天结了冰，只剩一点点声音
const STREAM_LEVEL = { spring: 0.6, summer: 0.6, autumn: 0.55, winter: 0.2 }

/// 「自动」时每种声音多响（0–1）。篝火和小溪另算：点着了才有火声，离得越近越响
function natural(scene, camp, player) {
  const table = MIX[scene.season]
  const wet = table[scene.weather]
  const levels = {}
  for (const id of Object.keys(SOUNDS)) levels[id] = wet ? (wet[id] ?? 0) : (table.day[id] ?? 0) * (1 - scene.night) + (table.night[id] ?? 0) * scene.night
  levels.fire = camp.heat * (0.25 + 0.75 * (1 - smooth(4, 34, Math.hypot(player.x - camp.x, player.z - camp.z))))
  levels.stream = STREAM_LEVEL[scene.season] * (1 - smooth(3, 28, distanceTo(STREAM, player.x, player.z)))
  return levels
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
