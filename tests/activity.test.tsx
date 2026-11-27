import { expect, test } from 'claude-code/testing'

/** Stands in for the engine's state: keeps what the mod writes under each key, and hands it back. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeState(on: (event: any, hook: (...args: any[]) => unknown) => unknown) {
  const stored = new Map<string, unknown>()
  let version = 0
  on('state.get', (_, e) => ({ value: { value: stored.get(String(e.key)), version } }))
  on('state.set', (_, e) => {
    stored.set(String(e.key), e.value)
    version += 1
    return { value: { isSet: true, version } }
  })
  on('ui.log', () => ({ value: undefined }))
  // a value kept with a shape tag comes back as { shape, value }
  return (key: string) => {
    const held = stored.get(key) as { value?: unknown } | undefined
    return (held?.value ?? held) as Record<string, unknown> | undefined
  }
}

test('a tool call turns the globe to tool mode and counts a ping', async ($, on) => {
  const state = fakeState(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const settle = async () => {
    for (let i = 0; i < 400; i += 1) await Promise.resolve()
  }
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  await settle()

  const now = state('activity')
  expect(now?.mode).toBe('tool')
  expect(now?.tool).toBe('Bash')
  expect(now?.ping).toBe(2)
})

test('the backdrop draws the globe on the desktop', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'test' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'ascii-night-pond', component: 'Backdrop', surface: 'desktop', props: { scene: 'ascii-globe', plugin: 'ascii-night-pond', glass: false } })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  await ui.unmount()
})
