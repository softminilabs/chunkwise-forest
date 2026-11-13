// 界面上的小声音全是现算的，没有音频文件：按一下的啵、收卡片的叮。森林的环境声是另一回事，在 sounds.js
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]

export function createAudio(state) {
  let context = null
  let master = null
  let noiseBuffer = null

  /// 浏览器要等用户点过一下才让出声，所以第一次用到时才建
  function ensure() {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = state.town.sound ? 0.7 : 0
      master.connect(context.createDynamicsCompressor()).connect(context.destination)
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (context.state === 'suspended') context.resume()
    return context
  }

  function tone(frequency, { delay = 0, length = 0.2, type = 'sine', gain = 0.18, slide = 0, into = master } = {}) {
    const start = ensure().currentTime + delay
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), start + length)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length)
    oscillator.connect(envelope).connect(into)
    oscillator.start(start)
    oscillator.stop(start + length + 0.02)
  }

  function noise({ delay = 0, length = 0.1, gain = 0.1, type = 'bandpass', frequency = 1200, into = master, loop = false } = {}) {
    const start = ensure().currentTime + delay
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    source.buffer = noiseBuffer
    source.loop = loop
    filter.type = type
    filter.frequency.value = frequency
    envelope.gain.setValueAtTime(loop ? gain : 0.0001, start)
    if (!loop) { envelope.gain.exponentialRampToValueAtTime(gain, start + 0.004); envelope.gain.exponentialRampToValueAtTime(0.0001, start + length) }
    source.connect(filter).connect(envelope).connect(into)
    source.start(start, Math.random())
    if (!loop) source.stop(start + length + 0.02)
    return { source, filter, envelope }
  }

  return {
    unlock: ensure,
    // 环境声（sounds.js）接在同一个总音量上：没点过页面之前这两个都是空的
    get context() { return context },
    get out() { return master },
    setSound(on) { ensure(); master.gain.setTargetAtTime(on ? 0.7 : 0, context.currentTime, 0.05) },
    pop: () => tone(430, { length: 0.1, type: 'triangle', slide: 300, gain: 0.16 }),
    tap: () => tone(240, { length: 0.07, type: 'triangle', slide: -90, gain: 0.14 }),
    tick: (high = false) => tone(high ? 1320 : 880, { length: 0.05, type: 'square', gain: 0.05 }),
    wrong: () => { tone(220, { length: 0.16, type: 'sawtooth', gain: 0.07, slide: -60 }); tone(180, { delay: 0.12, length: 0.2, type: 'sawtooth', gain: 0.07, slide: -50 }) },
    // 收东西的声音：五声音阶往上走，收得越多音越高
    chime(steps = 3) { for (let k = 0; k < steps; k++) tone(SCALE[Math.min(k, SCALE.length - 1)], { delay: k * 0.085, length: 0.4, gain: 0.14 }) },
    bell: () => { for (const [k, f] of [1318.5, 1568, 1318.5, 1568].entries()) tone(f, { delay: k * 0.09, length: 0.12, type: 'square', gain: 0.05 }) },
    whoosh: (power = 1) => noise({ length: 0.5 + power * 0.4, gain: 0.25 * power, type: 'bandpass', frequency: 700 }),
    step: () => { if (context) noise({ length: 0.035, gain: 0.025, type: 'lowpass', frequency: 900 }) },
  }
}
