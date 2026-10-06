export { createReporting } from './service.js'
export { reportingHandlers } from './routes.js'

/** @param {ReturnType<typeof import('./service.js').createReporting>} s @returns {Record<string, (ctx: { job: { payload: any } }) => Promise<void>>} */
export const reportingJobs = (s) => ({
  'reporting.sales_counts': async () => s.salesCounts(),
  'reporting.cleanup': async () => s.cleanup(),
})
