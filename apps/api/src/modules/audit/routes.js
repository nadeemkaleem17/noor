/**
 * @param {ReturnType<typeof import('./service.js').createAuditService>} audit
 * @returns {Partial<import('../../platform/http/route-registrar.js').Handlers<import('@noor/contract').Routes>>}
 */
export const auditHandlers = (audit) => ({
  'admin.audit.list': async ({ actor, query }) => audit.list(actor, query),
  'admin.audit.get': async ({ actor, params }) => audit.get(actor, params.id),
})
