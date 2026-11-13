// 我的 App 清单：从个人网站 softminilabs.github.io 读（那里有每款的中文名、一句话卖点和图标，贴纸类本来就不列），
// 存成 public/apps/apps.json 和 public/apps/icons/。新 App 上架、个人网站更新后再跑一次
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = 'https://softminilabs.github.io'
const OUT = 'public/apps'
const text = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
const pick = (html, pattern) => pattern.exec(html)?.[1] ?? ''

function parseRow(row) {
  const slug = pick(row, /href="\/([\w-]+)\.html"/)
  const name = pick(row, /app-row-name">([\s\S]*?)<\/p>/)
  const tagline = pick(row, /app-row-tagline">([\s\S]*?)<\/p>/)
  const zhName = pick(name, /data-lang="zh">([\s\S]*?)<\/span>/)
  const enName = pick(name, /data-lang="en">([\s\S]*?)<\/span>/)
  return {
    id: slug,
    zh: text(zhName.replace(/<small>[\s\S]*?<\/small>/, '')),
    en: text(enName.replace(/<small>[\s\S]*?<\/small>/, '')),
    tagline: text(pick(tagline, /data-lang="zh">([\s\S]*?)<\/span>/)),
    taglineEn: text(pick(tagline, /data-lang="en">([\s\S]*?)<\/span>/)),
    category: pick(row, /data-category="([^"]+)"/).replace(/&amp;/g, '&'),
    iconPath: pick(row, /<img src="([^"]+)"/),
  }
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
    const icon = Buffer.from(await (await fetch(`${SITE}${app.iconPath}`)).arrayBuffer())
    writeFileSync(`${OUT}/icons/${app.id}.webp`, icon)
    const { iconPath, ...rest } = app
    // 不带地区的链接：苹果会按访客所在地区跳转
    apps.push({ ...rest, icon: `apps/icons/${app.id}.webp`, store: `https://apps.apple.com/app/id${storeId}`, site: `${SITE}/${app.id}.html` })
  }
  writeFileSync(`${OUT}/apps.json`, JSON.stringify(apps, null, 2))
  console.log(`App 清单：${apps.length} 款\n${apps.map(app => `  ${app.id}  ${app.zh || app.en}  ${app.tagline}`).join('\n')}`)
}

main()
