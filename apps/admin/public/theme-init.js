// Resolves the saved or system theme before first paint, so a dark-mode user never sees a white flash.
// A file of its own, not inline in index.html: the admin's content security policy allows scripts only from its own address (plan/11-security-auth.md section 5.3).
try {
  var t = (JSON.parse(localStorage.getItem('noor.admin.prefs') || '{}') || {}).theme
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch {
  // no storage (a private window): the page takes the system theme
}
