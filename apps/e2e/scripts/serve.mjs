// Starts the three servers of the end-to-end run by hand (for looking at the prepared shop in a browser): API 3100, storefront 4174, admin 4173.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { adminBuildEnv, apiEnv, ports, root, storefrontEnv } from '../env.mjs'

const start = (/** @type {string[]} */ args, /** @type {string} */ cwd, /** @type {Record<string, string>} */ env = {}) =>
  spawn('node', args, { cwd: path.join(root, cwd), env: { ...process.env, ...env }, stdio: 'inherit' })
start(['src/main.js'], 'apps/api', apiEnv())
start(['node_modules/@react-router/serve/bin.cjs', './build/server/index.js'], 'apps/storefront', storefrontEnv())
start(['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(ports.admin), '--strictPort'], 'apps/admin', adminBuildEnv())
