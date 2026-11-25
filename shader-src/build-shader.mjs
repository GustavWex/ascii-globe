// Fills LAND_ROWS in the shader source with the land bitmask, built from the outlines in scene.ts.
import { readFileSync, writeFileSync } from 'node:fs'

const [src, sceneFile, out, look = 'cobalt'] = process.argv.slice(2)
// Each look's field, sea, near land and far-side land, as 0 to 1 RGB.
const PALETTES = {
  cobalt: { FIELD: '0.094, 0.133, 0.416', SEA: '0.36, 0.43, 0.84', LAND: '0.8, 0.84, 1.0', BACK: '0.47, 0.54, 0.88' },
  grey: { FIELD: '0.149, 0.149, 0.141', SEA: '0.42, 0.41, 0.39', LAND: '0.87, 0.85, 0.81', BACK: '0.55, 0.53, 0.5' },
}
const scene = readFileSync(sceneFile, 'utf8')
const landSrc = scene.slice(scene.indexOf('const LAND'), scene.indexOf(']\n\nfunction inside'))
const LAND = eval(landSrc.slice(landSrc.indexOf('= [') + 2) + ']')

function inside(lon, lat, poly) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

// Antarctica's coast, roughly: the latitude it reaches at each longitude, with the peninsula reaching north toward South
// America and the Ross and Weddell seas cutting deep into it, so it looks different as the globe turns.
const ANTARCTIC_COAST = [
  [-180, -78], [-150, -76], [-120, -73], [-90, -72], [-75, -70], [-62, -64], [-57, -63], [-55, -68], [-45, -77], [-30, -76],
  [-20, -72], [0, -70], [30, -69], [60, -67], [90, -66], [120, -66], [150, -69], [165, -72], [180, -78],
]
function antarctic(lon, lat) {
  for (let i = 1; i < ANTARCTIC_COAST.length; i += 1) {
    const [x1, y1] = ANTARCTIC_COAST[i - 1]
    const [x2, y2] = ANTARCTIC_COAST[i]
    if (lon <= x2) return lat < y1 + ((y2 - y1) * (lon - x1)) / (x2 - x1)
  }
  return lat < -78
}

const rows = []
let landCells = 0
for (let y = 0; y < 64; y += 1) {
  const words = [0, 0, 0, 0]
  for (let x = 0; x < 128; x += 1) {
    const lon = -180 + (x + 0.5) * (360 / 128)
    const lat = 90 - (y + 0.5) * (180 / 64)
    if (antarctic(lon, lat) || LAND.some(p => inside(lon, lat, p))) {
      words[x >> 5] |= 1 << (x & 31)
      landCells += 1
    }
  }
  rows.push(`[${words.map(w => w | 0).join(', ')}]`)
}
// The ASCII ramp, lightest to heaviest, as 5 by 7 pixel patterns.
const RAMP = [
  [' ', ['.....', '.....', '.....', '.....', '.....', '.....', '.....']],
  ['.', ['.....', '.....', '.....', '.....', '.....', '..#..', '.....']],
  [':', ['.....', '.....', '..#..', '.....', '.....', '..#..', '.....']],
  ['-', ['.....', '.....', '.....', '.###.', '.....', '.....', '.....']],
  ['=', ['.....', '.....', '#####', '.....', '#####', '.....', '.....']],
  ['+', ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....']],
  ['*', ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....']],
  ['#', ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.']],
  ['%', ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##']],
  ['@', ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####']],
]
const glyphRows = RAMP.map(([, pattern]) => {
  const words = [0, 0]
  pattern.forEach((line, row) => {
    for (let col = 0; col < 5; col += 1) {
      if (line[col] !== '#') continue
      const i = row * 5 + col
      if (i < 30) words[0] |= 1 << i
      else words[1] |= 1 << (i - 30)
    }
  })
  return `[${words.join(', ')}]`
})

const text = readFileSync(src, 'utf8')
  .replace('LAND_ROWS', `[\n  ${rows.join(',\n  ')},\n]`)
  .replace('GLYPH_ROWS', `[\n  ${glyphRows.join(',\n  ')},\n]`)
  .replace(/PAL_(FIELD|SEA|LAND|BACK)/g, (_, k) => PALETTES[look][k])
writeFileSync(out, text)
console.log('land cells', landCells, 'of', 128 * 64, 'chars', text.length)
