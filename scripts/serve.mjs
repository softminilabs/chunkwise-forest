// 本地预览 public/。要支持 Range 请求：浏览器拖进度条、点句子跳读，都是按字节范围取音频，
// 不支持的话 Safari 和 Chrome 都没法跳
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve('public')
const PORT = Number(process.env.PORT ?? 4174)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
}

function resolvePath(url) {
  const path = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  const file = normalize(join(ROOT, path))
  if (!file.startsWith(ROOT)) return null
  if (existsSync(file) && statSync(file).isDirectory()) return join(file, 'index.html')
  return file
}

createServer((request, response) => {
  const file = resolvePath(request.url)
  if (!file || !existsSync(file)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return response.end('没有这个页面')
  }
  const size = statSync(file).size
  const type = TYPES[extname(file)] ?? 'application/octet-stream'
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.range ?? '')
  if (match) {
    const start = match[1] ? Number(match[1]) : 0
    const end = match[2] ? Number(match[2]) : size - 1
    response.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 })
    return createReadStream(file, { start, end }).pipe(response)
  }
  response.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size })
  createReadStream(file).pipe(response)
}).listen(PORT, () => {
  // 同一个 Wi-Fi 下的手机打不开 localhost，要用这台电脑在局域网里的地址
  const lan = Object.values(networkInterfaces()).flat().find(net => net.family === 'IPv4' && !net.internal)?.address
  console.log(`本地预览：http://localhost:${PORT}/` + (lan ? `\n手机上看（同一个 Wi-Fi）：http://${lan}:${PORT}/` : ''))
})
