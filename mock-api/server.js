import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Product, Category, Settings } from './schemas.js'
import * as seed from './seed.js'

// In-memory state, validated against the contract on boot. Lost on restart.
let products = seed.products.map((p) => Product.parse(p))
const categories = seed.categories.map((c) => Category.parse(c))
let settings = Settings.parse(seed.settings)
const uploads = new Map() // name -> { buffer, type }; oldest dropped past MAX_UPLOADS
const MAX_UPLOADS = 50
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }

const { ADMIN_KEY, PUBLIC_URL, PORT = 3000 } = process.env
if (!ADMIN_KEY) console.warn('ADMIN_KEY is not set: all /api/admin routes will return 503.')

const app = express()
app.set('trust proxy', 1) // Render terminates TLS; lets req.protocol report https
app.use(cors({ allowedHeaders: ['Content-Type', 'x-admin-key'] }))
app.use(express.json({ limit: '1mb' }))
app.use(express.static(`${import.meta.dirname}/public`))

const httpError = (status, error, extra) => Object.assign(new Error(error), { status, extra })
const validate = (schema, body) => {
  const r = schema.safeParse(body)
  if (!r.success) throw httpError(400, 'Validation failed', { issues: r.error.issues })
  return r.data
}
const digest = (s) => createHash('sha256').update(String(s)).digest()
const requireAdmin = (req, res, next) => {
  if (!ADMIN_KEY) return next(httpError(503, 'Admin API disabled: ADMIN_KEY not configured'))
  const key = req.get('x-admin-key')
  if (!key || !timingSafeEqual(digest(key), digest(ADMIN_KEY))) return next(httpError(401, 'Invalid or missing x-admin-key'))
  next()
}
const findProduct = (id) => products.find((p) => p.id === id)
const assertUniqueHandle = (handle, exceptId) => {
  if (products.some((p) => p.handle === handle && p.id !== exceptId)) throw httpError(409, `Handle "${handle}" is already in use`)
}

// ---------------------------------------------------------------- health ---
app.get('/health', (req, res) => {
  res.json({ ok: true, uptimeSec: Math.round(process.uptime()), counts: { products: products.length, categories: categories.length, uploads: uploads.size } })
})

// ---------------------------------------------------------------- public ---
const pub = express.Router()
pub.get('/products', (req, res) => res.json(products.filter((p) => p.status === 'active')))
pub.get('/products/:id', (req, res) => {
  const p = products.find((x) => (x.id === req.params.id || x.handle === req.params.id) && x.status === 'active')
  if (!p) throw httpError(404, 'Product not found')
  res.json(p)
})
pub.get('/categories', (req, res) => res.json(categories))
pub.get('/settings', (req, res) => {
  res.json({ ...settings, heroSlides: [...settings.heroSlides].sort((a, b) => a.sortOrder - b.sortOrder) })
})
app.use('/api/public', pub)

// ----------------------------------------------------------------- admin ---
const admin = express.Router()
admin.use(requireAdmin)
admin.post('/products', (req, res) => {
  const data = validate(Product.partial({ id: true }), req.body)
  const product = { ...data, id: data.id || `p_${randomUUID().slice(0, 8)}` }
  if (findProduct(product.id)) throw httpError(409, `Product "${product.id}" already exists`)
  assertUniqueHandle(product.handle)
  products.push(product)
  res.status(201).json(product)
})
admin.put('/products/:id', (req, res) => {
  if (!findProduct(req.params.id)) throw httpError(404, 'Product not found')
  const product = validate(Product, { ...req.body, id: req.params.id })
  assertUniqueHandle(product.handle, product.id)
  products = products.map((p) => (p.id === product.id ? product : p))
  res.json(product)
})
admin.delete('/products/:id', (req, res) => {
  if (!findProduct(req.params.id)) throw httpError(404, 'Product not found')
  products = products.filter((p) => p.id !== req.params.id)
  res.status(204).end()
})
admin.put('/settings', (req, res) => {
  settings = validate(Settings, req.body)
  res.json(settings)
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (IMAGE_TYPES[file.mimetype]
    ? cb(null, true)
    : cb(httpError(400, 'Only JPEG, PNG, WebP, GIF or AVIF images are allowed'))),
})
admin.post('/uploads', upload.single('file'), (req, res) => {
  if (!req.file) throw httpError(400, 'Send the image as multipart form field "file"')
  const name = `${randomUUID()}.${IMAGE_TYPES[req.file.mimetype]}`
  uploads.set(name, { buffer: req.file.buffer, type: req.file.mimetype })
  if (uploads.size > MAX_UPLOADS) uploads.delete(uploads.keys().next().value)
  const base = PUBLIC_URL || `${req.protocol}://${req.get('host')}`
  res.status(201).json({ url: `${base}/uploads/${name}`, size: req.file.size, type: req.file.mimetype })
})
app.use('/api/admin', admin)

app.get('/uploads/:name', (req, res) => {
  const file = uploads.get(req.params.name)
  if (!file) throw httpError(404, 'Upload not found (uploads are lost on restart)')
  res.set({ 'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600' }).send(file.buffer)
})

// ---------------------------------------------------------------- errors ---
app.use((req, res, next) => next(httpError(404, `No route for ${req.method} ${req.path}`)))
app.use((err, req, res, _next) => {
  let status = err.status || err.statusCode || 500
  if (err instanceof multer.MulterError) status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  if (status === 500) console.error(err)
  const error = status === 500 ? 'Internal server error' : err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message
  res.status(status).json({ error, ...err.extra })
})

app.listen(PORT, () => console.log(`mock-api listening on http://localhost:${PORT}`))
