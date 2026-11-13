// 我的 App 清单：有哪几款、一句话卖点和图标从个人网站 softminilabs.github.io 读（贴纸类本来就不列），
// 名称以 App Store 上架的为准——个人网站上是手写的短名，有两款和商店对不上。
// 存成 public/apps/apps.json 和 public/apps/icons/。新 App 上架、个人网站更新后再跑一次
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = 'https://softminilabs.github.io'
const LOOKUP = 'https://itunes.apple.com/lookup'
const OUT = 'public/apps'
const text = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
const pick = (html, pattern) => pattern.exec(html)?.[1] ?? ''

function parseRow(row) {
  const slug = pick(row, /href="\/([\w-]+)\.html"/)
  const name = pick(row, /app-row-name">([\s\S]*?)<\/p>/)
  const tagline = pick(row, /app-row-tagline">([\s\S]*?)<\/p>/)
  const brand = language => text(pick(name, new RegExp(`data-lang="${language}">([\\s\\S]*?)<\\/span>`)).replace(/<small>[\s\S]*?<\/small>/, ''))
  return {
    id: slug,
    brandZh: brand('zh'),
    brandEn: brand('en'),
    tagline: text(pick(tagline, /data-lang="zh">([\s\S]*?)<\/span>/)),
    taglineEn: text(pick(tagline, /data-lang="en">([\s\S]*?)<\/span>/)),
    category: pick(row, /data-category="([^"]+)"/).replace(/&amp;/g, '&'),
    iconPath: pick(row, /<img src="([^"]+)"/),
  }
}

async function storeName(storeId, query) {
  const res = await fetch(`${LOOKUP}?id=${storeId}&${query}`)
  if (!res.ok) throw new Error(`id${storeId}：App Store 查询失败（${res.status}）`)
  return (await res.json()).results?.[0]?.trackName ?? ''
}

// 商店里的名称后面常带一长串说明（「番茄钟-番茄专注计时器」），牌子和卡片上放不下，只显示主名：
// 第一个分隔符之前那段要是和个人网站上写的名字一样，就用它；不一样就用商店的全名
// ——岁时在商店里叫「岁时日晷 / Sundial Time Marks」，念念的英文名整个是一句描述「Anniversary-Birthday Countdown」
const shown = (store, site) => { const head = store.split(/\s*[-:：·]\s*/)[0]; return head === site ? head : store }

async function storeNames(slug, storeId) {
  const en = await storeName(storeId, 'country=us')
  let zh = await storeName(storeId, 'country=cn')
  if (!zh) {
    // 没在中国区上架的查不到，改用美国区的简体中文本地化：两边都上架的那些，这两处是同一个名字
    zh = await storeName(storeId, 'country=us&lang=zh_cn')
    console.warn(`${slug}：中国区没查到，中文名用的是美国区的简体中文本地化`)
  }
  if (!zh || !en) throw new Error(`${slug}：App Store 里没查到名称`)
  return { zh, en }
}

async function main() {
  mkdirSync(`${OUT}/icons`, { recursive: true })
  const home = await (await fetch(`${SITE}/`)).text()
  const rows = home.match(/<li data-category="[\s\S]*?<\/li>/g) ?? []
  const apps = []
  for (const row of rows) {
    const app = parseRow(row)
    const detail = await (await fetch(`${SITE}/${app.id}.html`)).text()
    const storeId = pick(detail, /apps\.apple\.com\/[^"']*?id(\d+)/)
    if (!storeId) throw new Error(`${app.id}：详情页里没找到 App Store 链接`)
    const store = await storeNames(app.id, storeId)
    const names = { zh: shown(store.zh, app.brandZh), en: shown(store.en, app.brandEn) }
    console.log(`  ${app.id}  商店：${store.zh}｜${store.en}  →  显示：${names.zh}｜${names.en}`)
    const icon = Buffer.from(await (await fetch(`${SITE}${app.iconPath}`)).arrayBuffer())
    writeFileSync(`${OUT}/icons/${app.id}.webp`, icon)
    const { id, iconPath, brandZh, brandEn, ...rest } = app
    // 不带地区的链接：苹果会按访客所在地区跳转
    apps.push({ id, ...names, ...rest, icon: `apps/icons/${app.id}.webp`, store: `https://apps.apple.com/app/id${storeId}`, site: `${SITE}/${app.id}.html` })
  }
  writeFileSync(`${OUT}/apps.json`, JSON.stringify(apps, null, 2))
  console.log(`App 清单：${apps.length} 款`)
}

main()
