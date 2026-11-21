import assert from 'node:assert/strict'

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

Object.assign(globalThis, {
  document: { documentElement: { classList: { add() {}, remove() {} } } },
  window: Object.assign(new EventTarget(), { location: { protocol: 'http:', pathname: '/' } }),
  localStorage: new MemoryStorage(),
})

const { useMachineStore: store } = await import('../src/store')
const { JogPad, TabletJogPad } = await import('../src/components/JogPad')
const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server.browser')

// Zustand renders the initial state on the server; keep it in step with the store.
const renderState = store.getInitialState()
function render(component: (props: { initialContinuous?: boolean }) => unknown, state: Record<string, unknown>, props = { initialContinuous: false }) {
  store.setState({ ...state, status: { ...store.getState().status, state: 'Idle' } })
  Object.assign(renderState, store.getState())
  return renderToStaticMarkup(createElement(component as never, props as never))
}
const stepButtons = (html: string) => [...html.matchAll(/>([\d.]+)<\/button>/g)].map(m => m[1])

// Both pads open in continuous mode: the step buttons are not the active choice.
assert.match(render(TabletJogPad, { units: 'mm', fineJog: false }, {}), /shadow-inner" aria-label="Continuous jog"/)
assert.ok(render(JogPad, { units: 'mm', fineJog: false }, {}).includes('Keyboard jog ON'), 'keyboard jog is on by default')
assert.ok(!render(JogPad, { units: 'mm', fineJog: false }).includes('Keyboard jog ON'), 'step mode has no keyboard jog')

// Compact pad: Fine swaps the 0.1 mm step for 0.01 mm and shows its state.
let html = render(TabletJogPad, { units: 'mm', fineJog: false })
assert.deepEqual(stepButtons(html), ['0.1', '1', '10', '100'])
assert.match(html, /aria-pressed="false"[^>]*>Fine</)
html = render(TabletJogPad, { units: 'mm', fineJog: true })
assert.deepEqual(stepButtons(html), ['0.01', '1', '10', '100'])
assert.match(html, /aria-pressed="true"[^>]*>Fine</)

// Inch steps already go down to 0.001 in: no Fine button, steps unchanged.
html = render(TabletJogPad, { units: 'in', fineJog: true })
assert.deepEqual(stepButtons(html), ['0.001', '0.01', '0.1', '1'])
assert.ok(!html.includes('>Fine<'))

// Rose: the inner ring and the Z bar use 0.01 mm, labelled with its decimals.
html = render(JogPad, { units: 'mm', fineJog: true })
assert.match(html, />0\.01<\/text>/)
assert.ok(!html.includes('>0.1</text>'))
assert.match(html, /aria-pressed="true"[^>]*>Fine</)
html = render(JogPad, { units: 'mm', fineJog: false })
assert.match(html, />0\.1<\/text>/)
assert.ok(!html.includes('>0.01</text>'))

console.log('fine jog tests passed')
