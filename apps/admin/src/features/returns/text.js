/** The words for a request's kind, reason and status. */
export const kindText = /** @type {Record<string, string>} */ ({ return: 'Return', exchange: 'Exchange' })
export const reasonText = /** @type {Record<string, string>} */ ({
  wrong_size: 'Does not fit',
  not_as_described: 'Not as shown or described',
  defective: 'Damaged or faulty',
  changed_mind: 'Changed their mind',
  other: 'Something else',
})
export const statusText = /** @type {Record<string, string>} */ ({ requested: 'Waiting', approved: 'Approved', declined: 'Declined', received: 'Items received', completed: 'Done' })
export const statusTone = /** @type {Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'>} */ ({ requested: 'warning', approved: 'accent', received: 'accent', completed: 'success', declined: 'danger' })
/** The button for each step. */
export const stepText = /** @type {Record<string, string>} */ ({ approved: 'Approve', declined: 'Decline', received: 'Mark received', completed: 'Mark done' })
