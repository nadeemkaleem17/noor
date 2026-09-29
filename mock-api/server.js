import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Product, Category, Settings, Order, OrderInput } from './schemas.js'
import * as seed from './seed.js'

// In-memory state, validated against the contract on boot. Lost on restart (or POST /api/admin/reset).
let products, categories, settings, orders
function loadSeed() {
  products = structuredClone(seed.products).map((p) => Product.parse(p))
  categories = structuredClone(seed.categories).map((c) => Category.parse(c))
  settings = Settings.parse(structuredClone(seed.settings))
  orders = structuredClone(seed.orders).map((o) => Order.parse(o))
}
loadSeed()
const uploads = new Map() // name -> { buffer, type }; oldest dropped past MAX_UPLOADS
const MAX_UPLOADS = 200
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
const assertUniqueHandle = (list, handle, exceptId) => {
  if (list.some((x) => x.handle === handle && x.id !== exceptId)) throw httpError(409, `Handle "${handle}" is already in use`)
}
const newId = (prefix) => `${prefix}_${randomUUID().slice(0, 8)}`
// Drafts/archived products may be incomplete (no media or priced variants yet), same rule as the admin.
const productSchema = (body) => (body?.status === 'draft' || body?.status === 'archived'
  ? Product.partial().required({ handle: true, title: true, status: true, id: true })
  : Product)
const digits = (s) => String(s ?? '').replace(/\D/g, '')
const publicOrder = ({ internalNotes: _hidden, ...order }) => order
const nextOrderNo = () => `SF-${orders.reduce((max, o) => Math.max(max, parseInt(digits(o.orderNo), 10) || 0), 10000) + 1}`

// ---------------------------------------------------------------- health ---
app.get('/health', (req, res) => {
  res.json({ ok: true, uptimeSec: Math.round(process.uptime()), counts: { products: products.length, categories: categories.length, orders: orders.length, uploads: uploads.size } })
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

// Checkout. Prices and stock are checked against the catalog (a client can't set its own price),
// then stock is decremented so the admin sees it immediately.
pub.post('/orders', (req, res) => {
  const input = validate(OrderInput, req.body)
  const picked = input.lines.map((line) => {
    const product = products.find((p) => p.id === line.productId && p.status === 'active')
    const variant = product?.variants.find((v) => v.id === line.variantId)
    if (!variant) throw httpError(409, `"${line.title}" is no longer available`)
    if (variant.price.amount !== line.price.amount) throw httpError(409, `The price of "${line.title}" has changed — refresh and try again`)
    const { status, quantity } = variant.stock
    if (status === 'sold_out' || (Number.isInteger(quantity) && quantity < line.qty)) {
      throw httpError(409, `Only ${quantity ?? 0} of "${line.title}" (${line.variantLabel}) left`)
    }
    return { line, variant }
  })
  const subtotal = input.lines.reduce((sum, l) => sum + l.price.amount * l.qty, 0)
  if (subtotal !== input.subtotal.amount) throw httpError(409, 'Order subtotal does not match its lines')

  for (const { line, variant } of picked) {
    if (!Number.isInteger(variant.stock.quantity)) continue // made-to-order / preorder: no count to decrement
    variant.stock.quantity -= line.qty
    if (variant.stock.quantity === 0) variant.stock.status = 'sold_out'
    else if (variant.stock.quantity <= 3) variant.stock.status = 'low_stock'
  }
  const createdAt = new Date().toISOString()
  const order = Order.parse({ ...input, id: newId('o'), orderNo: nextOrderNo(), status: 'pending', createdAt, history: [{ status: 'pending', at: createdAt }] })
  orders.unshift(order)
  res.status(201).json(publicOrder(order))
})

// Order tracking: only a matching order number AND phone returns the order.
pub.get('/orders/:orderNo', (req, res) => {
  const no = digits(req.params.orderNo)
  const phone = digits(req.query.phone)
  const order = phone && orders.find((o) => digits(o.orderNo) === no && digits(o.customer.phone) === phone)
  if (!order) throw httpError(404, 'No order matches that number and phone')
  res.json(publicOrder(order))
})
app.use('/api/public', pub)

// ----------------------------------------------------------------- admin ---
const admin = express.Router()
admin.use(requireAdmin)
admin.get('/products', (req, res) => res.json(products)) // every status, incl. drafts
admin.post('/products', (req, res) => {
  const body = { ...req.body, id: req.body?.id || newId('p') }
  const product = validate(productSchema(body), body)
  if (findProduct(product.id)) throw httpError(409, `Product "${product.id}" already exists`)
  assertUniqueHandle(products, product.handle)
  products.unshift(product)
  res.status(201).json(product)
})
admin.put('/products/:id', (req, res) => {
  if (!findProduct(req.params.id)) throw httpError(404, 'Product not found')
  const body = { ...req.body, id: req.params.id }
  const product = validate(productSchema(body), body)
  assertUniqueHandle(products, product.handle, product.id)
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

admin.get('/categories', (req, res) => res.json(categories))
admin.post('/categories', (req, res) => {
  const category = validate(Category, { ...req.body, id: req.body?.id || newId('cat') })
  if (categories.some((c) => c.id === category.id)) throw httpError(409, `Category "${category.id}" already exists`)
  assertUniqueHandle(categories, category.handle)
  categories.push(category)
  res.status(201).json(category)
})
admin.put('/categories/:id', (req, res) => {
  if (!categories.some((c) => c.id === req.params.id)) throw httpError(404, 'Category not found')
  const category = validate(Category, { ...req.body, id: req.params.id })
  assertUniqueHandle(categories, category.handle, category.id)
  categories = categories.map((c) => (c.id === category.id ? category : c))
  res.json(category)
})
admin.delete('/categories/:id', (req, res) => {
  if (!categories.some((c) => c.id === req.params.id)) throw httpError(404, 'Category not found')
  categories = categories.filter((c) => c.id !== req.params.id)
  res.status(204).end()
})

admin.get('/orders', (req, res) => res.json(orders))
admin.put('/orders/:id', (req, res) => {
  if (!orders.some((o) => o.id === req.params.id)) throw httpError(404, 'Order not found')
  const order = validate(Order, { ...req.body, id: req.params.id })
  orders = orders.map((o) => (o.id === order.id ? order : o))
  res.json(order)
})

// Back to the seed data (uploads are kept so image URLs already in use don't break).
admin.post('/reset', (req, res) => {
  loadSeed()
  res.json({ ok: true })
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
