// Cobalt Globe, in 3D: a see-through globe in the bottom-left corner of a cobalt-indigo field, typed out in ASCII.
// The window over the globe is a grid of character cells; each cell reads the turning sphere at its centre (land or sea,
// how squarely it faces the viewer, with a slow grain) and prints the character of that weight from a ramp, so the
// globe shades smoothly from heavy land to faint sea and off toward the rim. Through the near side's sea the far side's
// land shows, damped, in dimmer characters. The characters jitter by a step now and then, and a ring of faint ones marks the rim.
// Lights: spots on the land light up like cities at night. None at rest; while Claude works many of them
// switch on, in the current tool's colour; each tool call sends a wave of light across the land from a random place;
// after an error they turn a dim red and falter. Dragging on the globe spins it, and it coasts to its own pace again.
// Near the top right, a nebula typed in the same characters hints at how much of the context window is used.
// The layout is the still Svg's: a chart of 1600 by 1000 points pinned to the bottom-left of the window, y up here.
import {
  PI, abs, atan, buffer, clamp, cos, dot, step, dt, exp, first, floor, fract, int, length, max, min, mix,
  picture, pointers, shader, sin, size, smoothstep, sqrt, table, time, unsigned, values, vec2, vec3, vec4,
} from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

const W = 1600
const H = 1000
const CX = 215
const CY = 190
const R = 175
const TILT = 0.35
// How strongly the globe prints over the field, so it sits back like the nebula instead of standing out.
const MUTE = 0.68
// A character cell, and one pixel of a character, in points.
const CW = 7.5
const CH = 11
const GP = 1.3
// The size of one light's patch of land, in degrees.
const LIGHT_DEG = 3

// What the mod tells the globe: how busy Claude is (the globe turns faster while it works), the current tool's hue,
// whether the last turn ended in an error, a toggle that flips once for each tool call that should send out a wave,
// how full the context is (as a share of the point where auto-compaction runs, or of the window when it is off), and
// what fills it, as shares of the coloured part: messages, system tools and MCP tools; the rest is what came in since
// the last update.
const session = values({ busy: [0, 1], hue: [0, 1], alarm: [0, 1], ping: [0, 1], fill: [0, 1], messages: [0, 1], systemTools: [0, 1], mcpTools: [0, 1] })

// A pale pastel of a hue, 0 to 1 round the wheel: a tool's colour. Between two tools it slides round the wheel.
const pastel = (h: number) => {
  const rgb = vec3(clamp(abs(fract(vec3(h, h + 2 / 3, h + 1 / 3)) * 6 - 3) - 1, 0, 1))
  return vec3(mix(vec3(1, 1, 1), rgb, 0.42) * 0.96)
}

// The land, 128 by 64 cells from the north pole down and from 180 west eastward, one bit a cell, 32 cells an int.
const LAND = table([
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 524288, 0, 0],
  [0, 33553920, 0, 0],
  [0, 33554304, 0, 48],
  [0, 33553920, -2147483648, 255],
  [-1048576, 33552399, -16777216, -1],
  [-64, 16773183, -2089024, 67108863],
  [-16, 2093183, -16, 33554431],
  [-32, 520447, -8, 33554431],
  [-32, 61951, -4, 16777215],
  [-65408, 1023, -8, 262143],
  [-262144, 1073743871, -4, 65535],
  [-524288, -2147479553, -2, 262143],
  [-524288, -2147479553, -1, 131071],
  [-1048576, -2147482625, -1, 131071],
  [-1048576, -1073741569, -7181, 65535],
  [-1048576, -536870849, -31, 16383],
  [-1048576, -536870881, -3968, 145407],
  [-2097152, -1073741793, -8177, 75775],
  [-8388608, -536870897, -4065, 2047],
  [-16777216, -268435451, -4097, 2047],
  [1040187392, -134217720, -4097, 2047],
  [1040187392, -134217728, -14688257, 1023],
  [1006632960, -67108864, 2114969599, 126],
  [-268435456, -67108863, 1007149055, 124],
  [-2147483648, -67108863, 470007807, 120],
  [0, -67108862, 134250495, 120],
  [0, -134215708, 134479871, 24],
  [0, -268431376, 131071, 16],
  [0, 8176, 65528, 788],
  [0, 16368, 65520, 904],
  [0, 65528, 32752, 896],
  [0, 524280, 16368, 458752],
  [0, 524272, 16352, 917504],
  [0, 524272, 16368, 0],
  [0, 524256, 16368, 507904],
  [0, 262080, 212976, 1044480],
  [0, 262016, 81904, 1047552],
  [0, 262016, 73696, 2096640],
  [0, 65408, 69600, 4194048],
  [0, 32640, 4032, 4194048],
  [0, 16256, 1984, 4194048],
  [0, 3968, 384, 4169472],
  [0, 1984, 0, 4063232],
  [0, 960, 0, 0],
  [0, 448, 0, 0],
  [0, 448, 0, 0],
  [0, 192, 0, 0],
  [0, 192, 0, 0],
  [0, 192, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 2048, 0, 0],
  [0, 3840, -2147483648, 2047],
  [0, 8128, -2048, 2097151],
  [0, -67092482, -1, 67108863],
  [-65536, -8355841, -1, 536870911],
  [-16, -1, -1, 2147483647],
  [-1, -1, -1, -1],
  [-1, -1, -1, -1],
  [-1, -1, -1, -1],
  [-1, -1, -1, -1],
], 'int')

// The ramp, from blank to heaviest, each character 5 by 7 pixels, row by row from the top: the first 30 bits in the
// first int, the last row in the second.
const GLYPHS = table([
  [0, 0],
  [134217728, 0],
  [134221824, 0],
  [458752, 0],
  [32537600, 0],
  [139432064, 0],
  [720353952, 0],
  [368409930, 10],
  [841097843, 25],
  [64681518, 30],
], 'int')
const RAMP = 10


const zoom = () => max(size.x / W, size.y / H)

// An integer mixer for the noise: two multiplies fold the pair, then xor-shifts and a multiply.
const mixBits = (x: number, y: number) => {
  let h = int(x * 0x2d8a61b7 + y * 0x6e13c94d + 977)
  h = int(h ^ (h >>> 15))
  h = int(h * 0x3b52a7e9)
  h = int(h ^ (h >>> 13))
  return unsigned(h) / 4294967296
}

// One texel kept between frames. x: how far the globe has turned, in turns. y: the ping toggle last seen.
// z: seconds since the last ping. w: the extra spin a drag gave it, in turns a second.
const state: Buffer = buffer({ size: [1, 1], float: 32, filter: 'nearest' }, (p): vec4 => {
  const was = state.at(vec2(0, 0))
  let drag = was.w * exp(-dt * 1.4)
  for (const f of pointers) {
    const at = vec2(f.at / zoom())
    const near = length(vec2(at - vec2(CX, CY))) < R * 1.1 ? 1 : 0
    const moved = (f.at.x - f.was.x) / zoom()
    // a held press on the bare backdrop over the globe pushes it round, the surface following the hand
    drag = drag - near * f.down * (1 - f.over) * (f.gone > 0 ? 0 : 1) * (moved / (2 * PI * R)) / max(dt, 0.001) * 0.35
  }
  drag = clamp(drag, -1.5, 1.5)
  // one turn in 40 seconds at rest, in 16 while Claude works
  const spin = mix(1 / 40, 1 / 16, session.busy)
  const turned = fract(was.x + dt * (spin + drag))
  const flipped = abs(session.ping - was.y) > 0.5 ? 1 : 0
  const age = flipped > 0 ? 0 : min(was.z + dt, 60)
  if (first) {
    return vec4(0.3, session.ping, 60, 0)
  }
  return vec4(turned, flipped > 0 ? session.ping : was.y, age, drag)
})

const mod360 = (x: number) => x - floor(x / 360) * 360

// Whether the land cell under a latitude and longitude, in degrees, is land: 1 or 0.
const landAt = (lat: number, lon: number) => {
  const cx = mod360(lon + 180) / 360 * 128
  const cy = clamp(floor((90 - lat) / 180 * 64), 0, 63)
  const col = floor(cx)
  const row = LAND.at(cy)
  const q = floor(col / 32)
  const word = q < 0.5 ? row[0] : q < 1.5 ? row[1] : q < 2.5 ? row[2] : row[3]
  return unsigned(int((word >>> int(col - q * 32)) & int(1)))
}

// The latitude and longitude, in degrees, at a point of the sphere's surface, `nz` toward the viewer (negative on the
// far side), with the north pole tipped toward the viewer and the globe turned by `turned`.
const surfaceAt = (nx: number, ny: number, nz: number, turned: number) => {
  const y2 = ny * cos(TILT) + nz * sin(TILT)
  const z2 = -ny * sin(TILT) + nz * cos(TILT)
  const lat = atan(y2, length(vec2(nx, z2))) * 180 / PI
  const lon = mod360(atan(nx, z2) * 180 / PI + turned * 360) - 180
  return vec2(lat, lon)
}

// A point on the unit sphere for a latitude and longitude in degrees.
const unitAt = (lat: number, lon: number) => {
  const a = lat * PI / 180
  const b = lon * PI / 180
  return vec3(cos(a) * sin(b), sin(a), cos(a) * cos(b))
}

// An arc cosine good enough for distances on the sphere, from the shader's two-argument arc tangent.
const acosish = (c: number) => {
  const k = clamp(c, -1, 1)
  return atan(sqrt(max(0, 1 - k * k)), k)
}

// Smooth noise on a lattice: the mixer at the four corners, blended.
const valueNoise = (q: number) => {
  const i = vec2(floor(q))
  const f = vec2(q - i)
  const u = vec2(f * f * (vec2(3, 3) - f * 2))
  const a = mixBits(int(i.x), int(i.y))
  const b = mixBits(int(i.x + 1), int(i.y))
  const c = mixBits(int(i.x), int(i.y + 1))
  const d = mixBits(int(i.x + 1), int(i.y + 1))
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y)
}

// How much of a patch a few degrees across is land, 0 to 1: the cell itself and four neighbours, so coasts shade off.
const softLand = (lat: number, lon: number) => {
  const dLon = 1.6 / max(cos(lat * PI / 180), 0.2)
  return (
    landAt(lat, lon) * 0.6 +
    (landAt(lat + 1.6, lon) + landAt(lat - 1.6, lon) + landAt(lat, lon + dLon) + landAt(lat, lon - dLon)) * 0.1
  )
}

// One pixel of a ramp character: 1 where it is inked.
const glyphBit = (g: number, col: number, row: number) => {
  const bits = GLYPHS.at(g)
  const i = row * 5 + col
  const word = i < 30 ? bits[0] : bits[1]
  const k = i < 30 ? i : i - 30
  const inside = col >= 0 && col < 5 && row >= 0 && row < 7 ? 1 : 0
  return unsigned(int((word >>> int(k)) & int(1))) * inside
}

// A dotted circle: how much of a dot of radius `dotR` covers a spot `along` points round the circle and `off` points off it,
// with dots every `gap` points.
const dotted = (along: number, off: number, gap: number, dotR: number, aa: number) => {
  const a = (fract(along / gap + 0.5) - 0.5) * gap
  return 1 - smoothstep(dotR - aa, dotR + aa, length(vec2(a, off)))
}

const ground = picture(p => {
  const z = zoom()
  const pt = vec2(p.point / z)
  const aa = max(p.px / z, 0.6)
  const s = state.at(vec2(0, 0))

  // the field: one flat cobalt, the same as the glass over it
  let color = vec3(0.094, 0.133, 0.416)

  const toolInk = pastel(session.hue)
  const alarm = session.alarm
  const falter = mix(1, 0.55 + 0.35 * sin(time * 0.9), alarm)
  // a tool call's wave: it starts from a place picked by the moment it came, and crosses the land over 2.6 seconds
  const life = clamp(s.z / 2.6, 0, 1)
  const waving = s.z < 2.6 ? 1 : 0
  const born = floor((time - s.z) * 10)
  const origin = unitAt(-35 + 95 * mixBits(int(born), int(17)), -180 + 360 * mixBits(int(born), int(29)))

  // the globe, typed out: the character cell this pixel is in, read at its centre
  const gx = floor((pt.x - CX) / CW)
  const gy = floor((pt.y - CY) / CH)
  const cc = vec2(CX + (gx + 0.5) * CW, CY + (gy + 0.5) * CH)
  const crel = vec2((cc - vec2(CX, CY)) / R)
  const cr = length(crel)
  if (cr < 1) {
    // each cell picks a fresh bit of noise about once a second, at its own moment
    const seed = mixBits(int(gx), int(gy))
    const tick = floor(time * 0.9 + seed * 7)
    const jitter = mixBits(int(gx + tick * 131), int(gy - tick * 71))
    const sea = vec3(0.36, 0.43, 0.84)
    const land = vec3(0.8, 0.84, 1.0)
    let level = 0
    let tone = vec3(sea)
    let alpha = 0.7
    let glow = 0
    if (cr < 1) {
      const nz = sqrt(max(0, 1 - cr * cr))
      const here = surfaceAt(crel.x, crel.y, nz, s.x)
      const far = surfaceAt(crel.x, crel.y, -nz, s.x)
      // land softened over a few degrees, so coasts shade off instead of stopping
      const front = smoothstep(0.2, 0.8, softLand(here.x, here.y))
      const back = smoothstep(0.2, 0.8, softLand(far.x, far.y))
      // a slow grain tied to the surface, so the shading has texture that turns with the globe
      const grain = valueNoise(vec2(here.y * 0.22, here.x * 0.22)) - 0.5
      // the near side: sea faint, land heavy, both fading smoothly toward the rim
      const near = clamp(mix(0.1, 0.86, front) * (0.62 + 0.38 * nz) + grain * 0.06, 0, 1)
      // the far side, seen through the near side's sea: the same land, damped, dimmer toward the middle of the disc
      const through = back * (0.52 - 0.18 * nz) * (1 - 0.85 * front)
      const useBack = step(near, through)
      // the rim: the outermost cells print at least a faint character, so the disc has a clear edge
      const rim = smoothstep(0.93, 0.985, cr) * 0.2
      level = max(max(near, through), rim)
      const frontTone = vec3(mix(sea, land, front) * mix(0.55, 1, smoothstep(0.15, 0.8, near)))
      tone = vec3(mix(frontTone, vec3(0.47, 0.54, 0.88), useBack))
      alpha = mix(clamp(near * 1.5, 0.3, 1), 0.58, useBack)

      // the lights: each patch of land has its own threshold; the busier Claude is, the more patches pass it
      const li = floor(here.x / LIGHT_DEG)
      const lj = floor(here.y / LIGHT_DEG)
      const mark = mixBits(int(li + 400), int(lj + 400))
      const share = 0.5 * session.busy + 0.2 * alarm
      const steady = smoothstep(share, share - 0.04, mark)
      const twinkle = 0.7 + 0.3 * sin(time * (0.5 + mark) + mark * 40)
      // the wave lights everything it has passed, brightest at its front, fading as it ages
      const dist = acosish(dot(unitAt(here.x, here.y), origin))
      const reach = life * 1.4
      const wave = waving * (1 - life) * (smoothstep(reach + 0.12, reach - 0.04, dist) * 0.5 + exp(-((dist - reach) * (dist - reach)) / 0.01))
      glow = step(0.5, front) * nz * clamp(max(steady * twinkle * falter, min(wave * smoothstep(0.75, 0.2, mark), 1)), 0, 1)
    }
    level = level + (jitter - 0.5) * 0.1 * step(0.04, level)
    // a lit patch prints the heaviest characters
    const g = clamp(floor(max(level, glow * 1.05) * RAMP), 0, RAMP - 1)
    const col = floor((pt.x - (cc.x - CW * 0.5) - 0.55) / GP)
    const row = floor((cc.y + CH * 0.5 - pt.y - 1) / GP)
    const ink = glyphBit(g, col, row)
    // lights take the tool's colour while Claude works, and a dim red after an error
    const warm = vec3(1.0, 0.86, 0.58)
    const lamp = vec3(mix(mix(warm, toolInk, 0.85), vec3(0.88, 0.45, 0.42), alarm))
    color = vec3(mix(color, vec3(mix(tone, lamp, glow)), ink * max(alpha * MUTE, glow * 0.85)))
  }

  // the nebula, toward the top right but clear of a side panel: a cloud of characters that grows larger and denser as
  // the context fills, a faint wisp in a fresh session and a thick swirl late in a long one. It turns slowly about its
  // core, which brightens as auto-compaction nears. Its characters take the colours the app's context panel uses, in
  // the shares of what fills the context: blue for messages, orange for system tools, teal for MCP tools, and purple
  // for what came in since the last update. The parts the panel shows in grey are left out.
  // Each tool call sends a soft brightening out from the core.
  const ctx = session.fill
  const view = vec2(size / z)
  const nc = vec2(view.x - 400, view.y - 210)
  const spread = 26 + 150 * sqrt(ctx)
  if (length(vec2(pt - nc)) < spread * 1.9 + 24) {
    const ngx = floor((pt.x - nc.x) / CW)
    const ngy = floor((pt.y - nc.y) / CH)
    const ncc = vec2((ngx + 0.5) * CW, (ngy + 0.5) * CH)
    const nr = length(ncc)
    // turn each cell's sampling point about the core, more the nearer it is, so the cloud swirls
    const ang = time * 0.03 + 1.8 * exp(-nr / spread)
    const sp = vec2(ncc.x * cos(ang) - ncc.y * sin(ang), ncc.x * sin(ang) + ncc.y * cos(ang))
    const stir = session.busy * 0.6
    const n1 = valueNoise(vec2(sp / 38 + vec2(time * 0.02, stir * sin(time * 0.3))))
    const n2 = valueNoise(vec2(sp / 16 + vec2(-stir * cos(time * 0.4), time * 0.03 + 9)))
    const cloud = n1 * 0.65 + n2 * 0.35
    const env = exp(-(nr * nr) / (spread * spread))
    let dens = smoothstep(0.28, 0.85, cloud) * env * (0.45 + 0.7 * sqrt(ctx)) + env * env * 0.3 * ctx
    const front = life * spread * 1.6
    dens = dens + waving * (1 - life) * 0.3 * exp(-((nr - front) * (nr - front)) / 500) * smoothstep(0.2, 0.6, cloud)
    const seed = mixBits(int(ngx + 700), int(ngy + 700))
    const tick = floor(time * 0.9 + seed * 7)
    const jitter = mixBits(int(ngx + tick * 131), int(ngy - tick * 71))
    const level = dens + (jitter - 0.5) * 0.18 * step(0.05, dens)
    const g = clamp(floor(level * RAMP), 0, RAMP - 1)
    const col = floor((pt.x - (nc.x + ngx * CW) - 0.55) / GP)
    const row = floor((nc.y + (ngy + 1) * CH - pt.y - 1) / GP)
    const ink = glyphBit(g, col, row)
    // which part of the context a character stands for: picked per small clump of the swirling cloud, so the colours
    // drift with it, in the shares the mod sends
    const pick = mixBits(int(floor(sp.x / (CW * 2))), int(floor(sp.y / (CH * 2)) + 300))
    const m = session.messages
    const st = m + session.systemTools
    const mc = st + session.mcpTools
    const isMessage = step(pick, m)
    const isSystem = (1 - isMessage) * step(pick, st)
    const isMcp = (1 - isMessage - isSystem) * step(pick, mc)
    const isRecent = 1 - isMessage - isSystem - isMcp
    const part = vec3(
      vec3(0.24, 0.55, 0.92) * isMessage + vec3(0.89, 0.42, 0.18) * isSystem + vec3(0.07, 0.65, 0.55) * isMcp + vec3(0.63, 0.55, 0.93) * isRecent,
    )
    // fainter at the wispy edge, brighter in the core, and brighter still as compaction nears
    const nearing = smoothstep(0.75, 1, ctx)
    const lift = clamp(mix(0.55, 1, smoothstep(0.2, 0.8, dens)) + nearing * env * 0.3, 0, 1.2)
    const tone = vec3(part * lift)
    color = vec3(mix(color, tone, ink * clamp(level * 1.4, 0, 1)))
  }

  return vec4(color, 1)
})

export default shader({ fps: 30, passes: [state, ground] })
