export function formatPKR(amount) {
    return 'Rs ' + Math.round(amount).toLocaleString('en-PK')
  }
  
  export function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  
  export function newId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9)
  }
  
  export function slugifyStoreName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  }

// Converts a local Pakistani number ("0300-1234567") into the digits-only
// international form wa.me needs ("923001234567"). Falls back gracefully
// if the number is already in another shape.
export function toWhatsAppNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.startsWith('92')) return digits
  if (digits.startsWith('0')) return '92' + digits.slice(1)
  return digits
}
