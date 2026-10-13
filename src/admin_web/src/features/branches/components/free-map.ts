/**
 * MapLibre's right-to-left shaping, served from this app: Arabic street
 * names joined and right to left. Reached by path, as the customer app does.
 */
export const rtlTextUrl = new URL(
  '../../../../node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
  import.meta.url
).href

/** Free street tiles, no key: OpenFreeMap's, the same the customers' map shows */
export const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
