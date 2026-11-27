/** What Claude is doing, as the backdrop shows it. `ping` counts tool calls, so a redraw knows a new one came. */
export type Activity = {
  mode: 'idle' | 'working' | 'tool' | 'error'
  tool: string
  ping: number
}

/**
 * How full the context window is, for the gauge: the percentage used (absent before the first reading), the parts in
 * use as shares of the window in /context's order, and where auto-compaction runs as a share of the window.
 */
export type Gauge = {
  percent?: number
  segments: [string, number][]
  compactAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'ascii-night-pond': {
      activity: Shaped<Activity>
      /** The context reading the gauge shows, taken when the session starts and when each turn ends. */
      gauge: Shaped<Gauge>
    }
  }
}
