// 一棵植物从种子到长成的五个样子：0 种子、1 芽、2 小苗、3 小树、4 长成。
// 按浇了几成水（grown，0..1）分；松树、桃花、花盆、选种子的卡片都照这张表
export const STAGE_FROM = [0, 0, 0.2, 0.5, 1]
/// 浇了第一滴就是芽，浇满才算长成
export const stageOf = grown => grown >= 1 ? 4 : grown >= 0.5 ? 3 : grown >= 0.2 ? 2 : grown > 0 ? 1 : 0
/// 在现在这个样子里走了多远（0..1）。同一个样子里每浇一滴也要长一点，花盆拿它来缩放
export const within = grown => { const k = stageOf(grown); return k === 0 || k === 4 ? 1 : (grown - STAGE_FROM[k]) / (STAGE_FROM[k + 1] - STAGE_FROM[k]) }
/// 长到第 k 个样子要浇几滴。total：这棵一共要几滴
export const dropsFor = (k, total) => k <= 1 ? k : Math.ceil(STAGE_FROM[k] * total)
