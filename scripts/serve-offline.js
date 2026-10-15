// Serves the Gatsby build in ./public as a static site, with no network access or dependencies.
// Maps clean URLs (/about-npm) to their folder index (public/about-npm/index.html)
// without a trailing-slash redirect, since the site is built with trailingSlash: 'never'.
//
// Usage: node scripts/serve-offline.js [port] [dir]

const http = require('http')
const path = require('path')
const fs = require('fs')

const port = Number(process.argv[2] || process.env.PORT || 8000)
const root = path.resolve(process.argv[3] || path.join(__dirname, '..', 'public'))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
}

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`No build found in ${root}. Run a Gatsby build first.`)
  process.exit(1)
}

const resolveFile = urlPath => {
  const file = path.join(root, urlPath)
  if (!file.startsWith(root)) {
    return null
  }
  for (const candidate of [file, path.join(file, 'index.html')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

const send = (res, status, file) => {
  res.writeHead(status, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'})
  fs.createReadStream(file).pipe(res)
}

http
  .createServer((req, res) => {
    let urlPath
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      res.writeHead(400).end()
      return
    }
    const file = resolveFile(urlPath)
    if (file) {
      send(res, 200, file)
    } else {
      send(res, 404, path.join(root, '404.html'))
    }
  })
  .listen(port, '0.0.0.0', () => console.log(`Serving ${root} at http://localhost:${port}`))
