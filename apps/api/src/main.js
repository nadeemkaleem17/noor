import { buildApp } from './app.js'
import { ConfigError, loadConfig } from './platform/config.js'
import { createAppDatabase, databaseReadiness } from './platform/db.js'
import { startBackground } from './platform/runtime.js'

let config
try {
  config = loadConfig()
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(e.message)
    process.exit(1)
  }
  throw e
}

const { pool, db } = createAppDatabase(config)
const app = await buildApp({ config, db, readiness: databaseReadiness(pool) })
app.addHook('onClose', async () => pool.end())

// ponytail: no module has handlers or events yet; modules add theirs here as they are built (M1-02 onward)
if (config.DEV_INLINE_WORKER) {
  const background = startBackground({ db, handlers: {}, eventHandlers: {}, log: app.log })
  app.addHook('onClose', async () => background.stop())
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: config.HOST, port: config.PORT })
