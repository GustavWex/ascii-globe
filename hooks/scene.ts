// Cobalt Globe: a halftone dot globe turning in the bottom-left corner of a muted cobalt-indigo field.
// The globe is a fixed screen of dots, as a print would be: small sea dots stay put, and the land dots of
// FRAMES views of the turning earth fade one into the next. What Claude is doing sets how fast it turns,
// whether a ring of dots orbits it, the ring's colour, and a single soft ping on each tool call.
// Pure string building: the heavy part is built once, the style for each activity on demand.

import type { Activity, Gauge } from '../types'

const W = 1600
const H = 1000
const CX = 250
const CY = 780
const R = 215
const STEP = 11
const FRAMES = 26
const TILT = (-18 * Math.PI) / 180

// Rough continents as lon/lat outlines: enough for a halftone at this size.
const LAND: readonly (readonly [number, number])[][] = [
  // North America
  [[-168, 66], [-162, 70], [-140, 70], [-120, 72], [-95, 72], [-80, 73], [-65, 62], [-60, 55], [-55, 50], [-66, 45], [-70, 42], [-76, 38], [-76, 35], [-81, 31], [-80, 26], [-82, 25], [-84, 30], [-90, 29], [-97, 27], [-97, 22], [-92, 18], [-87, 21], [-88, 16], [-83, 10], [-78, 8], [-80, 7], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 30], [-117, 33], [-121, 35], [-124, 40], [-124, 47], [-130, 55], [-140, 60], [-150, 60], [-158, 57], [-165, 60]],
  // Greenland
  [[-55, 60], [-45, 60], [-20, 70], [-18, 80], [-35, 83], [-60, 82], [-70, 77], [-55, 70]],
  // South America
  [[-80, 8], [-72, 12], [-60, 10], [-50, 0], [-35, -5], [-38, -13], [-40, -22], [-48, -26], [-58, -35], [-65, -40], [-68, -50], [-70, -55], [-74, -50], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [5, 53], [8, 57], [5, 62], [12, 66], [20, 70], [30, 71], [40, 68], [45, 60], [40, 45], [30, 46], [28, 41], [22, 37], [15, 40], [12, 44], [8, 44], [3, 42], [-2, 37]],
  // Britain and Iceland
  [[-5, 50], [1, 51], [0, 53], [-3, 56], [-6, 58], [-5, 55], [-3, 54]],
  [[-24, 64], [-13, 65], [-16, 66], [-22, 66]],
  // Africa and Madagascar
  [[-17, 15], [-17, 21], [-13, 28], [-6, 35], [10, 37], [11, 33], [20, 31], [32, 31], [34, 27], [38, 18], [43, 12], [51, 12], [44, 2], [40, -5], [40, -15], [35, -24], [32, -29], [20, -35], [18, -30], [12, -17], [13, -6], [9, 4], [5, 5], [-4, 5], [-8, 4], [-13, 8]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Asia
  [[28, 41], [36, 36], [35, 32], [43, 13], [52, 16], [57, 22], [60, 25], [67, 25], [72, 20], [77, 8], [80, 15], [88, 22], [92, 22], [98, 16], [100, 8], [104, 1], [105, 10], [109, 12], [108, 21], [117, 23], [122, 30], [121, 40], [128, 35], [129, 42], [135, 44], [141, 52], [136, 55], [143, 59], [155, 59], [160, 61], [163, 70], [180, 69], [180, 72], [140, 73], [113, 74], [105, 78], [80, 73], [70, 73], [60, 69], [45, 68], [40, 68], [45, 60], [40, 45]],
  // Japan, the islands, New Guinea
  [[130, 31], [132, 34], [140, 36], [142, 40], [141, 45], [139, 38], [132, 33]],
  [[109, -1], [110, 2], [117, 7], [119, 1], [116, -4]],
  [[95, 5], [98, 4], [106, -6], [104, -5]],
  [[131, -1], [141, -3], [150, -10], [141, -9]],
  // Australia
  [[113, -22], [114, -35], [123, -34], [131, -31], [138, -35], [147, -38], [150, -37], [153, -28], [153, -25], [145, -15], [142, -11], [136, -12], [131, -12], [125, -15]],
]

function inside(lon: number, lat: number, poly: readonly (readonly [number, number])[]): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

// Antarctica's coast, roughly: the latitude it reaches at each longitude, with the peninsula reaching north toward South
// America and the Ross and Weddell seas cutting deep into it, so it looks different as the globe turns.
const ANTARCTIC_COAST: readonly (readonly [number, number])[] = [
  [-180, -78], [-150, -76], [-120, -73], [-90, -72], [-75, -70], [-62, -64], [-57, -63], [-55, -68], [-45, -77], [-30, -76],
  [-20, -72], [0, -70], [30, -69], [60, -67], [90, -66], [120, -66], [150, -69], [165, -72], [180, -78],
]
function antarctic(lon: number, lat: number): boolean {
  for (let i = 1; i < ANTARCTIC_COAST.length; i += 1) {
    const [x1, y1] = ANTARCTIC_COAST[i - 1]!
    const [x2, y2] = ANTARCTIC_COAST[i]!
    if (lon <= x2) return lat < y1 + ((y2 - y1) * (lon - x1)) / (x2 - x1)
  }
  return lat < -78
}

/** A 2-degree land raster, built once. */
const RASTER: boolean[] = (() => {
  const out: boolean[] = []
  for (let y = 0; y < 90; y += 1) {
    for (let x = 0; x < 180; x += 1) {
      const lon = -179 + x * 2
      const lat = 89 - y * 2
      out.push(antarctic(lon, lat) || LAND.some(p => inside(lon, lat, p)))
    }
  }
  return out
})()

function isLand(lon: number, lat: number): boolean {
  const x = Math.floor((((lon + 180) % 360) + 360) % 360 / 2)
  const y = Math.min(89, Math.max(0, Math.floor((90 - lat) / 2)))
  return RASTER[y * 180 + x] === true
}

type Dot = { x: number; y: number; nz: number; nx: number; ny: number }

/** The fixed screen of dots over the disc. */
const SCREEN: Dot[] = (() => {
  const dots: Dot[] = []
  for (let y = -R; y <= R; y += STEP) {
    for (let x = -R; x <= R; x += STEP) {
      const nx = x / R
      const ny = y / R
      const d = nx * nx + ny * ny
      if (d > 0.985) continue
      dots.push({ x: CX + x, y: CY + y, nx, ny, nz: Math.sqrt(1 - d) })
    }
  }
  return dots
})()

/** Paths of dots, one per size bucket, as zero-length round-capped strokes. */
function dots(list: readonly { x: number; y: number; size: number }[], cls: string): string {
  const buckets = new Map<number, string>()
  for (const d of list) buckets.set(d.size, (buckets.get(d.size) ?? '') + `M${Math.round(d.x)} ${Math.round(d.y)}h0`)
  let out = ''
  for (const [size, d] of buckets) out += `<path class="${cls}" stroke-width="${size}" d="${d}"/>`
  return out
}

function frame(k: number): string {
  const theta = (k / FRAMES) * Math.PI * 2
  const land = []
  for (const d of SCREEN) {
    // undo the tilt, then read latitude and longitude off the sphere
    const y = d.ny * Math.cos(TILT) - d.nz * Math.sin(TILT)
    const z = d.ny * Math.sin(TILT) + d.nz * Math.cos(TILT)
    const lat = (-Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI
    const lon = ((Math.atan2(d.nx, z) + theta) * 180) / Math.PI // eastward, as the earth turns
    if (!isLand(lon, lat)) continue
    const size = Math.round((3.2 + d.nz * 4.2) * 2) / 2
    land.push({ x: d.x, y: d.y, size })
  }
  return `<g class="fr fr${k}">${dots(land, 'land')}</g>`
}

const BODY = (() => {
  const sea = SCREEN.map(d => ({ x: d.x, y: d.y, size: Math.round((1.6 + d.nz * 1.6) * 2) / 2 }))
  let frames = ''
  for (let k = 0; k < FRAMES; k += 1) frames += frame(k)
  return (
    `<defs>` +
    `<linearGradient id="cg-field" x1="0" y1="1" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#1f2c86"/><stop offset="0.55" stop-color="#18226a"/><stop offset="1" stop-color="#121852"/>` +
    `</linearGradient>` +
    `<radialGradient id="cg-halo"><stop offset="0.45" stop-color="#3550d8" stop-opacity="0.32"/>` +
    `<stop offset="1" stop-color="#3550d8" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="#18226a"/>` +
    `<g class="globe">${dots(sea, 'sea')}${frames}</g>`
  )
})()

/** The ring of dots that orbits the globe while Claude works, and the ping a tool call sends out. */
function extras(ping: boolean): string {
  const ring =
    `<g transform="translate(${CX} ${CY}) rotate(-18)">` +
    `<ellipse class="orbit back" rx="${R * 1.42}" ry="${R * 0.34}"/>` +
    `</g>`
  const pulse = ping ? `<circle class="ping" cx="${CX}" cy="${CY}" r="${R}"/>` : ''
  return ring + pulse
}

/** What each activity looks like: how long a turn of the globe takes, and the ring's colour. */
const LOOKS: Record<Activity['mode'], { turn: number; ring?: string; halo: number }> = {
  idle: { turn: 40, halo: 0.55 },
  working: { turn: 16, ring: '#a9b6ff', halo: 0.8 },
  tool: { turn: 16, ring: '#a9b6ff', halo: 0.85 },
  error: { turn: 40, ring: '#e08a86', halo: 0.5 },
}

/** The ring's colour for a tool, by what kind of work it does. */
export function toolColor(tool: string): string {
  if (/^(Read|Grep|Glob|LS|WebFetch|WebSearch|ToolSearch)$/.test(tool)) return '#8fd0f0'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return '#eef0ff'
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) return '#86dcbc'
  if (/^(Agent|Task|SendMessage)$/.test(tool)) return '#c3a8ff'
  if (tool.startsWith('mcp__')) return '#f0c88a'
  return '#a9b6ff'
}

function style(activity: Activity, phase: number, ping: boolean): string {
  const look = LOOKS[activity.mode]
  const turn = look.turn
  const ring = activity.mode === 'tool' ? toolColor(activity.tool) : look.ring
  let rules = `
.sea { stroke: #4a5ac4; stroke-linecap: round; opacity: 0.55; }
.land { stroke: #c9d2ff; stroke-linecap: round; }
.fr { opacity: 0; animation: cg-frame ${turn}s linear infinite; }
.fr0 { opacity: 1; }
@keyframes cg-frame { 0% { opacity: 0; } ${r2(100 / FRAMES)}% { opacity: 1; } ${r2(200 / FRAMES)}% { opacity: 0; } 100% { opacity: 0; } }
.halo { opacity: ${look.halo}; transform-box: fill-box; transform-origin: center; animation: cg-breathe 12s ease-in-out infinite alternate; }
@keyframes cg-breathe { from { transform: scale(0.94); } to { transform: scale(1.04); } }
.orbit { fill: none; stroke-linecap: round; stroke-width: 3.2; stroke-dasharray: 0.1 13; opacity: 0; }
`
  for (let k = 0; k < FRAMES; k += 1) {
    // each view peaks when the turn reaches it, kept in step with where the globe was before this redraw
    let delay = ((k - 1) / FRAMES - phase) * turn
    while (delay > 0) delay -= turn
    rules += `.fr${k} { animation-delay: ${r2(delay)}s; }\n`
  }
  if (ring !== undefined) {
    rules += `.orbit { stroke: ${ring}; opacity: 0.7; animation: cg-orbit 9s linear infinite${activity.mode === 'error' ? ', cg-dim 4s ease-in-out infinite alternate' : ''}; }
@keyframes cg-orbit { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -264; } }
@keyframes cg-dim { from { opacity: 0.25; } to { opacity: 0.7; } }
`
  }
  if (ping) {
    rules += `.ping { fill: none; stroke: ${ring ?? '#a9b6ff'}; stroke-width: 2; stroke-dasharray: 0.1 12; stroke-linecap: round; opacity: 0;
  transform-box: fill-box; transform-origin: center; animation: cg-ping 2.6s ease-out 1 forwards; }
@keyframes cg-ping { 0% { opacity: 0.6; transform: scale(1.02); } 100% { opacity: 0; transform: scale(1.55); } }
`
  }
  return rules
}

function r2(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

// The context gauge's centre, on the right of the chat; halfway up, so it sits the same way up whichever way it is read.
export const MAP_X = 1330
export const MAP_Y = 500
const GAUGE_R = 120

/** The colour each kind of context is drawn in, by the name /context gives its row. */
function segmentColor(name: string): string {
  if (/messages/i.test(name)) return '#c9d2ff'
  if (/system prompt/i.test(name)) return '#8fd0f0'
  if (/system tools|tools/i.test(name) && !/mcp/i.test(name)) return '#86dcbc'
  if (/mcp/i.test(name)) return '#f0c88a'
  if (/memory/i.test(name)) return '#c3a8ff'
  if (/skill/i.test(name)) return '#e8a6c8'
  if (/agent/i.test(name)) return '#a8dca0'
  return '#a9b6ff'
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * How full the context window is, as an engraved gauge: a circle of 100 ticks from the top, clockwise, one for each
 * percent. The ticks in use take the colour of what fills them (messages, system prompt, tools...), in /context's order;
 * the rest stay faint. A long tick marks where auto-compaction runs. The percentage sits in the middle, the largest
 * parts are listed beneath.
 */
function gaugeSvg(gauge: Gauge): string {
  // which colour each tick takes, by walking the parts in order
  const colors: string[] = []
  for (const [name, share] of gauge.segments) {
    const n = Math.round(share * 100)
    for (let k = 0; k < n && colors.length < 100; k += 1) colors.push(segmentColor(name))
  }
  const filled = gauge.percent === undefined ? 0 : Math.min(100, Math.round(gauge.percent))
  while (colors.length < filled) colors.push('#c9d2ff')
  const byColor = new Map<string, string>()
  let faint = ''
  for (let i = 0; i < 100; i += 1) {
    const a = ((i / 100) * 360 - 90) * (Math.PI / 180)
    const outer = GAUGE_R + (i % 10 === 0 ? 16 : 10)
    const d = `M${r2(MAP_X + Math.cos(a) * GAUGE_R)} ${r2(MAP_Y + Math.sin(a) * GAUGE_R)}L${r2(MAP_X + Math.cos(a) * outer)} ${r2(MAP_Y + Math.sin(a) * outer)}`
    if (i < filled) {
      const c = colors[i] ?? '#c9d2ff'
      byColor.set(c, (byColor.get(c) ?? '') + d)
    } else {
      faint += d
    }
  }
  let ticks = `<path class="g-faint" d="${faint}"/>`
  for (const [c, d] of byColor) ticks += `<path class="g-tick" stroke="${c}" d="${d}"/>`
  // the auto-compaction mark
  let compact = ''
  if (gauge.compactAt !== undefined) {
    const a = (gauge.compactAt * 360 - 90) * (Math.PI / 180)
    compact =
      `<path class="g-compact" d="M${r2(MAP_X + Math.cos(a) * (GAUGE_R - 10))} ${r2(MAP_Y + Math.sin(a) * (GAUGE_R - 10))}` +
      `L${r2(MAP_X + Math.cos(a) * (GAUGE_R + 26))} ${r2(MAP_Y + Math.sin(a) * (GAUGE_R + 26))}"/>` +
      `<text class="g-small" x="${r2(MAP_X + Math.cos(a) * (GAUGE_R + 40))}" y="${r2(MAP_Y + Math.sin(a) * (GAUGE_R + 40) + 4)}" text-anchor="middle">compact</text>`
  }
  const label = gauge.percent === undefined ? '--%' : `${Math.round(gauge.percent)}%`
  // the largest parts, listed beneath
  const top = [...gauge.segments].sort((a, b) => b[1] - a[1]).slice(0, 4)
  let legend = ''
  top.forEach(([name, share], k) => {
    const y = MAP_Y + GAUGE_R + 62 + k * 17
    legend +=
      `<rect x="${MAP_X - 78}" y="${y - 8}" width="8" height="8" fill="${segmentColor(name)}"/>` +
      `<text class="g-small" x="${MAP_X - 64}" y="${y}">${esc(name.toLowerCase())}</text>` +
      `<text class="g-small" x="${MAP_X + 78}" y="${y}" text-anchor="end">${Math.max(1, Math.round(share * 100))}%</text>`
  })
  return (
    `<g class="gauge">` +
    ticks +
    compact +
    `<circle class="g-ring" cx="${MAP_X}" cy="${MAP_Y}" r="${GAUGE_R - 8}"/>` +
    `<text class="g-big" x="${MAP_X}" y="${MAP_Y + 10}" text-anchor="middle">${label}</text>` +
    `<text class="g-small" x="${MAP_X}" y="${MAP_Y + 32}" text-anchor="middle">context</text>` +
    legend +
    `</g>`
  )
}

const GAUGE_STYLE = `
.gauge path { fill: none; stroke-linecap: round; }
.g-faint { stroke: #a9b6ff; stroke-width: 1.6; opacity: 0.2; }
.g-tick { stroke-width: 2.2; opacity: 0.9; }
.g-compact { stroke: #f0c88a; stroke-width: 1.4; stroke-dasharray: 3 3; opacity: 0.8; }
.g-ring { fill: none; stroke: #a9b6ff; stroke-width: 1; stroke-dasharray: 1 5; opacity: 0.35; }
.gauge text { font-family: ui-monospace, Menlo, Consolas, monospace; fill: #dfe4ff; }
.g-big { font-size: 34px; opacity: 0.92; }
.g-small { font-size: 11px; opacity: 0.6; letter-spacing: 1px; }
`

/** The whole scene for one activity. `phase` (0 to 1) is how far round the globe has turned; `gauge` is the context reading. */
export function cobaltGlobeSvg(activity: Activity, phase: number, ping: boolean, gauge: Gauge): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMax slice">` +
    `<style>${style(activity, phase, ping)}${GAUGE_STYLE}</style>` +
    BODY +
    extras(ping) +
    gaugeSvg(gauge) +
    `</svg>`
  )
}

/** How long one turn of the globe takes in an activity, in seconds. */
export function turnSeconds(mode: Activity['mode']): number {
  return LOOKS[mode].turn
}

/** The two looks: the flat cobalt field, or the grey of Claude's own dark theme with a globe in neutral greys. */
export type { Look } from '../types'
import type { Look } from '../types'

// The glass over the backdrop behind the chat: exactly the field's flat colour, so it frosts without changing it.
export const GLASS_TINTS: Record<Look, string> = { cobalt: '#18226a', grey: '#191919' }

// The flat globe's cobalt colours and their grey counterparts.
const GREY_OF: Record<string, string> = {
  '#1f2c86': '#1e1e1e',
  '#18226a': '#191919',
  '#121852': '#151515',
  '#3550d8': '#707070',
  '#4a5ac4': '#666666',
  '#c9d2ff': '#dbdbdb',
  '#a9b6ff': '#b8b8b8',
  '#dfe4ff': '#e6e6e6',
}

/** The flat globe in a look: as drawn for cobalt, its blues swapped for greys for grey. */
export function inLook(svg: string, look: Look): string {
  return look === 'cobalt' ? svg : svg.replace(/#[0-9a-f]{6}/gi, c => GREY_OF[c.toLowerCase()] ?? c)
}
