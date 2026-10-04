export { createMediaService } from './service.js'

const staff = (/** @type {unknown} */ actor) => /** @type {import('./service.js').Staff} */ (actor)

/**
 * @param {ReturnType<typeof import('./service.js').createMediaService>} media
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export const mediaHandlers = (media) => ({
  'admin.media.createUpload': async ({ actor, body }) => media.createUpload(staff(actor), { contentType: body.contentType, bytes: body.bytes }),
  'admin.media.confirm': async ({ params }) => media.confirm(params.id),
  'admin.media.get': async ({ params }) => media.get(params.id),
  'admin.media.update': async ({ actor, params, body, http, requestId }) => media.update(staff(actor), params.id, body, { ip: http.ip, userAgent: http.userAgent, requestId }),
  'admin.media.delete': async ({ actor, params, http, requestId }) => {
    await media.remove(staff(actor), params.id, { ip: http.ip, userAgent: http.userAgent, requestId })
  },
})

/**
 * Job handlers of the module, registered by the process that runs the worker.
 * @param {ReturnType<typeof import('./service.js').createMediaService>} media
 * @returns {import('../../platform/worker.js').JobHandlers}
 */
export const mediaJobs = (media) => ({
  'media.process': async ({ job }) => media.process(job.payload.mediaId),
  'media.purge': async ({ job }) => media.purge(job.payload.objectKey),
  'media.cleanup': async () => media.cleanup(),
})
