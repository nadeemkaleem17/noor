// The worker process: jobs, outbox relay and scheduler without the HTTP server (production runs this beside the API).
import { ConfigError, loadConfig } from './platform/config.js'
import pino from 'pino'
import { createAppDatabase } from './platform/db.js'
import { loggerOptions } from './platform/logger.js'
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

const log = pino(/** @type {import('pino').LoggerOptions} */ (loggerOptions(config) || { level: 'silent' }))
const { pool, db } = createAppDatabase(config)
// ponytail: module handlers and event handlers are registered here as modules are built
const background = startBackground({ db, handlers: {}, eventHandlers: {}, log })
log.info('worker started')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log.info({ signal }, 'worker shutting down')
    void background.stop().then(() => pool.end()).then(() => process.exit(0))
  })
}
