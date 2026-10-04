import { buildApp } from './app.js'
import { ConfigError, loadConfig } from './platform/config.js'
import { createAppDatabase, databaseReadiness } from './platform/db.js'
import { startBackground } from './platform/runtime.js'
import { backgroundOf } from './modules/index.js'

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

if (config.DEV_INLINE_WORKER) {
  const background = startBackground({ db, ...backgroundOf({ db, config, log: app.log }), eventHandlers: {}, log: app.log })
  app.addHook('onClose', async () => background.stop())
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: config.HOST, port: config.PORT })
