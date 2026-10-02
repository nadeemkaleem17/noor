import { buildApp } from './app'
import { ConfigError, loadConfig } from './platform/config'

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

const app = await buildApp({ config })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app.close().then(() => process.exit(0))
  })
}

await app.listen({ host: config.HOST, port: config.PORT })
