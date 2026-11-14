// 水滴和花盆里种的那一棵。学完一个词得 1 滴、听完一课得 3 滴；到单词屋的花盆前浇水，浇够了就长成，记到荣誉墙上。
// 存在这台电脑的浏览器里（cw.garden），和课文、单词的进度分开存
export const WORD_DROPS = 1
export const LESSON_DROPS = 3
const read = () => { try { return JSON.parse(localStorage.getItem('cw.garden')) ?? {} } catch { return {} } }

/// plants：能种的几种（world/plants），按 id 找它一共要几滴水
export function createGarden(plants) {
  // water：壶里还有几滴；seed：盆里种的是哪种，null 是空盆；poured：这一棵已经浇了几滴；
  // done：长成了的 [{ seed, at }]；asked：进屋时提示过选种子了（只提示一回）
  const store = { water: 0, seed: null, poured: 0, done: [], asked: false, ...read() }
  const listeners = new Set()
  const save = () => { try { localStorage.setItem('cw.garden', JSON.stringify(store)) } catch {} for (const listener of listeners) listener() }

  return {
    store,
    on(listener) { listeners.add(listener) },
    set(values) { Object.assign(store, values); save() },
    earn(drops) { store.water += drops; save() },
    sow(seed) { Object.assign(store, { seed, poured: 0 }); save() },
    /// 盆里这一棵一共要几滴、浇了几成。空盆都是 0
    get need() { return store.seed ? plants[store.seed].drops : 0 },
    get grown() { return store.seed ? store.poured / plants[store.seed].drops : 0 },

    /// 把壶里的水浇下去：最多浇到这一棵长成，多的留在壶里。长成了就记到 done 里、把盆空出来。
    /// 返回浇的是哪种、浇了几滴、浇完是几成、长成了没有（界面拿去放动画）
    pour(now = Date.now()) {
      const { seed } = store
      const need = plants[seed].drops
      const poured = Math.min(store.water, need - store.poured)
      store.water -= poured
      store.poured += poured
      const grown = store.poured / need
      if (grown >= 1) Object.assign(store, { done: [...store.done, { seed, at: now }], seed: null, poured: 0 })
      save()
      return { seed, poured, grown, bloomed: grown >= 1 }
    },
  }
}
