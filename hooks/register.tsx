import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Activity, Gauge } from '../types'
import { GLASS_TINT, globeSvg, turnSeconds } from './scene'

const SCENE_ID = 'ascii-globe'
const NO_READING: Gauge = { segments: [] }
// What the demo shows on the gauge: a session well into its window.
const DEMO_GAUGE: Gauge = {
  percent: 62,
  segments: [['System prompt', 0.03], ['System tools', 0.08], ['MCP tools', 0.05], ['Memory files', 0.02], ['Messages', 0.44]],
  compactAt: 0.83,
}

// Change a tag when its type's fields change: it declines what an earlier version stored.
const activity = atom({ plugin: 'ascii-night-pond', key: 'activity' } as const, { mode: 'idle', tool: '', ping: 0 } satisfies Activity, {
  shape: 'activity-1',
})
const gauge = atom({ plugin: 'ascii-night-pond', key: 'gauge' } as const, NO_READING, { shape: 'gauge-1' })
const THEME: ThemeSetArgs = { overrideColorScheme: 'dark', backdrop: { scene: SCENE_ID, glass: { blur: 14, tint: GLASS_TINT, opacity: 0.55 } } }

// Where the globe is in its turn, so a redraw carries on from there instead of jumping: the flat globe takes it as its
// starting point, and the 3D one as where to start again if the app restarts its shader.
// Module variables start over on a reload, which costs one small jump at most.
let phase = 0
let since = Date.now()
let turning: Activity['mode'] = 'idle'
let lastPing = 0
let pingShownAt = 0
let pingToggle = 0
let demoRunning = false

function phaseNow(mode: Activity['mode']): number {
  const now = Date.now()
  phase = (phase + (now - since) / 1000 / turnSeconds(turning)) % 1
  since = now
  turning = mode
  return phase
}

/** Runs a state change; a failure here only costs the backdrop a beat, never the tool call or turn it rides on. */
async function quietly($: EngineInterface, work: () => Promise<unknown>): Promise<void> {
  try {
    await work()
  } catch (error) {
    $.ui.log(`ascii globe: ${String(error)}`)
  }
}

/** Reads the context window as /context breaks it down, estimated locally, which costs no request. */
async function readGauge($: EngineInterface): Promise<Gauge> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (b === undefined || b.rawMaxTokens <= 0) {
    return { percent: context.percent, segments: [] }
  }
  const segments: [string, number][] = b.categories
    .filter(c => c.kind === 'used' && c.tokens > 0)
    .map(c => [c.name, c.tokens / b.rawMaxTokens])
  return {
    percent: context.percent ?? b.percentage,
    segments,
    compactAt: b.isAutoCompactEnabled && b.autoCompactThreshold !== undefined ? b.autoCompactThreshold / b.rawMaxTokens : undefined,
  }
}

async function refreshGauge($: EngineInterface): Promise<void> {
  if (demoRunning) return
  await quietly($, async () => {
    const reading = await readGauge($)
    await update($, gauge, () => reading)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await quietly($, () => update($, activity, () => ({ mode: 'idle', tool: '', ping: 0 })))
    const set = await $.theme.set(THEME)
    if (!set.isDrawn) {
      $.ui.log(`ascii globe: not drawn (${set.reason})`)
    }
    await quietly($, () =>
      $.command.register({ name: 'globe-demo', description: 'Play every state the ASCII Globe theme reacts to, in about 40 seconds' }),
    )
    const answered = await next(e)
    await refreshGauge($)
    return answered
  })

  // A walk through every state, as if Claude were working: thinking, each kind of tool, a filled-in gauge, an error,
  // and back to rest. The real context reading is put back at the end.
  on('command.run', { command: 'globe-demo' }, async $ => {
    const set = (a: Activity) => quietly($, () => update($, activity, (was): Activity => ({ ...a, ping: was.ping + (a.mode === 'tool' ? 1 : 0) })))
    demoRunning = true
    const steps: [number, string, () => Promise<void>][] = [
      [0, 'Working: faster turn, more land lights on', () => set({ mode: 'working', tool: '', ping: 0 })],
      [4, 'Tool: Read (light blue), a wave of light', () => set({ mode: 'tool', tool: 'Read', ping: 0 })],
      [8, 'Tool: Grep (light blue)', () => set({ mode: 'tool', tool: 'Grep', ping: 0 })],
      [12, 'Tool: Edit (white)', () => set({ mode: 'tool', tool: 'Edit', ping: 0 })],
      [16, 'Tool: Bash (mint)', () => set({ mode: 'tool', tool: 'Bash', ping: 0 })],
      [20, 'Tool: Agent (violet)', () => set({ mode: 'tool', tool: 'Agent', ping: 0 })],
      [24, 'Tool: a connector (amber)', () => set({ mode: 'tool', tool: 'mcp__demo__search', ping: 0 })],
      [28, 'Turn ends: the nebula grows, as for a session well into its context', () => quietly($, () => update($, gauge, () => DEMO_GAUGE))],
      [30, 'Error: lights turn dim red and falter', () => set({ mode: 'error', tool: '', ping: 0 })],
      [37, 'Idle: lights off, slow turn', () => set({ mode: 'idle', tool: '', ping: 0 })],
      [41, 'Demo over: the nebula shows the real context again', async () => {
        demoRunning = false
        await refreshGauge($)
      }],
    ]
    for (const [at, label, run] of steps) {
      $.clock.after(at * 1000, async () => {
        $.ui.status(`Globe demo: ${label}`)
        await run()
        if (at === 41) $.ui.status(undefined)
      })
    }
    return { text: 'Globe demo started: watch the globe and the nebula at the top right for about 40 seconds. The status line names each state.' }
  })


  // The main loop only: a subagent's turns don't change the globe's mood.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await quietly($, () => update($, activity, (a): Activity => ({ ...a, mode: 'working' })))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    quietly($, () => update($, activity, (a): Activity => ({ mode: 'tool', tool: e.tool, ping: a.ping + 1 }))).catch(() => undefined)
    return next(e)
  })

  // When a turn of the main loop ends, the globe rests and the gauge takes a fresh reading, in one redraw.
  on('turn.complete', async ($, e, next) => {
    const answered = await next(e)
    if (e.agentId === undefined) {
      const mode: Activity['mode'] = e.reason === 'error' || e.reason === 'refusal' ? 'error' : 'idle'
      await quietly($, () => update($, activity, (a): Activity => ({ ...a, mode })))
      await refreshGauge($)
    }
    return answered
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE_ID) {
      return next(e)
    }
    const now = await read($, activity)
    const reading = await read($, gauge)
    // One wave per new tool call, and at most one every 1.5 s, so a burst of calls never flickers.
    let ping = false
    if (now.ping !== lastPing) {
      lastPing = now.ping
      if (Date.now() - pingShownAt > 1500) {
        ping = true
        pingShownAt = Date.now()
        pingToggle = 1 - pingToggle
      }
    }
    const { Svg, Shader } = $.ui.resolve(e)

    // An app that plays shaders draws the 3D globe and the context dial itself; the Svg beneath it is only its still,
    // which never changes, so a new activity or reading only changes the shader's values and nothing restarts.
    if (Shader !== undefined) {
      const values = shaderValues(now, pingToggle, reading)
      return (
        <Shader module="./globe-shader.ts" values={values}>
          <Svg source={STILL} alt="An ASCII globe and a context nebula on a dark grey field" isInteractive />
        </Shader>
      )
    }
    return (
      <Svg
        source={globeSvg(now, phaseNow(now.mode), ping, reading)}
        alt="A halftone globe and a context gauge on a dark grey field"
        isInteractive
      />
    )
  })
}

// The still beneath the shader: the flat globe and an empty gauge, made once.
const STILL = globeSvg({ mode: 'idle', tool: '', ping: 0 }, 0, false, NO_READING)

/** A tool's hue round the colour wheel, 0 to 1, by what kind of work it does; the shader makes a pale pastel of it. */
function toolHue(tool: string): number {
  if (/^(Read|Grep|Glob|LS|WebFetch|WebSearch|ToolSearch)$/.test(tool)) return 0.54 // light blue
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 0.66 // periwinkle
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) return 0.43 // mint
  if (/^(Agent|Task|SendMessage)$/.test(tool)) return 0.76 // violet
  if (tool.startsWith('mcp__')) return 0.1 // amber
  return 0.64
}

// The parts the app's context panel draws in grey, which the nebula leaves out.
const GREY = /system prompt|skill|instruction|memory|agent|slash|command/i

/**
 * What the shader is told: how busy Claude is, the tool's hue, an error, the wave, how full the context is toward
 * auto-compaction, and the shares of the coloured part of the context that are messages, system tools and MCP tools.
 */
function shaderValues(now: Activity, ping: number, reading: Gauge): Record<string, number> {
  const share = (reading.percent ?? 0) / 100
  const fill = reading.compactAt !== undefined && reading.compactAt > 0 ? share / reading.compactAt : share
  const colored = reading.segments.filter(([name]) => !GREY.test(name))
  const total = colored.reduce((sum, [, s]) => sum + s, 0)
  const of = (test: RegExp) => (total > 0 ? colored.filter(([name]) => test.test(name)).reduce((sum, [, s]) => sum + s, 0) / total : 0)
  const messages = total > 0 ? of(/messages/i) : 1
  const mcpTools = of(/mcp/i)
  const systemTools = of(/tool/i) - mcpTools
  return {
    busy: now.mode === 'idle' || now.mode === 'error' ? 0 : 1,
    hue: now.mode === 'tool' ? toolHue(now.tool) : 0.64,
    alarm: now.mode === 'error' ? 1 : 0,
    ping,
    fill: Math.min(1, Math.max(0, fill)),
    messages: Math.min(1, messages),
    systemTools: Math.max(0, systemTools),
    mcpTools: Math.max(0, mcpTools),
  }
}
