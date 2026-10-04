import { buildApp } from './app.js'
import { ConfigError, loadConfig } from './platform/config.js'
import { createAppDatabase, databaseReadiness } from './platform/db.js'

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

const { pool } = createAppDatabase(config)
const app = await buildApp({ config, readiness: databaseReadiness(pool) })
app.addHook('onClose', async () => pool.end())

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: config.HOST, port: config.PORT })
