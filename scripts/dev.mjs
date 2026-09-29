// Starts the whole local stack in one terminal: mock API + admin panel + storefront, already
// connected (via mock-api/.env and each app's .env.local). Ctrl+C stops all three.
//
//   npm run dev            (from the repo root)
//
// No dependencies: plain Node child processes with prefixed, coloured output.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const apps = [
  { name: 'api', color: 35, dir: 'mock-api', args: ['start'], url: 'http://localhost:3000' },
  { name: 'admin', color: 36, dir: 'admin-panel', args: ['run', 'dev', '--', '--port', '5173', '--strictPort'], url: 'http://localhost:5173' },
  { name: 'store', color: 33, dir: 'ecommerce-website', args: ['run', 'dev', '--', '--port', '5174', '--strictPort'], url: 'http://localhost:5174' },
]

const missing = apps.filter((a) => !existsSync(path.join(root, a.dir, 'node_modules')))
if (missing.length) {
  for (const a of missing) console.error(`Missing dependencies in ${a.dir}/ — run: cd ${a.dir} && npm install`)
  process.exit(1)
}
for (const [file, hint] of [
  ['mock-api/.env', 'ADMIN_KEY=dev-key'],
  ['admin-panel/.env.local', 'VITE_API_URL=http://localhost:3000 and VITE_ADMIN_KEY=dev-key'],
  ['ecommerce-website/.env.local', 'VITE_API_URL=http://localhost:3000'],
]) {
  if (!existsSync(path.join(root, file))) console.warn(`Note: ${file} is missing (${hint}) — that app won't be connected.`)
}

const tag = (a) => `\x1b[${a.color}m${a.name.padEnd(5)}\x1b[0m │ `
const children = []
let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  for (const { child } of children) {
    if (child.exitCode !== null) continue
    // npm on Windows runs through a shell; kill the whole process tree or vite/node keep running.
    if (isWin) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGINT')
  }
  setTimeout(() => process.exit(code), 500)
}

for (const app of apps) {
  // Windows needs a shell to run npm.cmd; pass one command string (the args are fixed, nothing user-supplied).
  const child = isWin
    ? spawn(`npm ${app.args.join(' ')}`, { cwd: path.join(root, app.dir), shell: true, env: process.env })
    : spawn('npm', app.args, { cwd: path.join(root, app.dir), env: process.env })
  children.push({ app, child })
  const pipe = (stream, out) => {
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) if (line.trim()) out.write(tag(app) + line + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    if (stopping) return
    console.error(`${tag(app)}exited with code ${code} — stopping the others.`)
    stopAll(code || 1)
  })
}

console.log([
  '',
  'Starting the local stack (Ctrl+C to stop):',
  ...apps.map((a) => `  ${tag(a)}${a.url}`),
  '',
].join('\n'))

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
