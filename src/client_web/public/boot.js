// Run before the app's own script, from a file of its own so the page's
// Content-Security-Policy can refuse every inline script.

// The business's brand, asked for as the page arrives rather than once the app's script has come and run:
// on a first visit the app waits for it before it draws (lib/brand.ts bootBrand takes it from here)
window.__brandRequest = fetch('/api/tenant', { headers: { Accept: 'application/json' } })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)

// The fonts, not render-blocking: a stylesheet still on its way holds the app's script back, and on a first
// visit this one is a lookup, a connection and a download from another host; the text swaps in when it lands
const fonts = document.createElement('link')
fonts.rel = 'stylesheet'
fonts.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap'
fonts.media = 'print'
fonts.onload = () => {
  fonts.media = 'all'
}
document.head.appendChild(fonts)
