// Tailwind config for the /design-sync stylesheet: the app's own config, plus
// the authored previews as a content source and the sizes Avatar builds
// dynamically (`w-${s} h-${s}`).
const base = require('../tailwind.config.js')

module.exports = {
  ...base,
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './.design-sync/previews/**/*.{ts,tsx}',
  ],
  safelist: [{ pattern: /^(w|h)-(1|2|3|4|5|6|8|10|12|16|20|24)$/ }],
}
