// The right-click menu that gives a row a background colour (issue #1). Its group inherits it.

const SWATCHES = ['#e5534b', '#e0823d', '#d8a24a', '#57ab5a', '#39a0a8', '#5b9bd5', '#9a7fd1', '#d16fa8']

export interface ColorMenuLabels {
  readonly menu: string
  readonly custom: string
  readonly clear: string
}

let closeOpen: (() => void) | null = null

/** Opens the menu at a point; `onPick` gets a #rrggbb colour, or null to clear. */
export function openColorMenu(
  x: number,
  y: number,
  current: string | null,
  labels: ColorMenuLabels,
  onPick: (color: string | null) => void
): void {
  closeOpen?.()
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const menu = document.createElement('div')
  menu.className = 'color-menu'
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', labels.menu)

  const outside = (event: Event): void => {
    if (!(event.target instanceof Node) || !menu.contains(event.target)) close()
  }
  const close = (): void => {
    menu.remove()
    document.removeEventListener('pointerdown', outside, true)
    closeOpen = null
    returnFocus?.focus()
  }
  const pick = (color: string | null): void => {
    close()
    onPick(color)
  }

  for (const color of SWATCHES) {
    const swatch = document.createElement('button')
    swatch.type = 'button'
    swatch.className = color === current ? 'swatch chosen' : 'swatch'
    swatch.style.background = color
    swatch.title = color
    swatch.setAttribute('role', 'menuitemradio')
    swatch.setAttribute('aria-checked', String(color === current))
    swatch.setAttribute('aria-label', color)
    swatch.addEventListener('click', () => pick(color))
    menu.appendChild(swatch)
  }
  const custom = document.createElement('input')
  custom.type = 'color'
  custom.className = 'custom'
  custom.value = current ?? SWATCHES[0]
  custom.title = labels.custom
  custom.setAttribute('aria-label', labels.custom)
  custom.addEventListener('change', () => pick(custom.value))
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'clear'
  clear.textContent = labels.clear
  clear.setAttribute('role', 'menuitem')
  clear.addEventListener('click', () => pick(null))
  menu.append(custom, clear)

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  })
  document.body.appendChild(menu)
  const { width, height } = menu.getBoundingClientRect()
  menu.style.left = `${Math.max(0, Math.min(x, window.innerWidth - width))}px`
  menu.style.top = `${Math.max(0, Math.min(y, window.innerHeight - height))}px`
  document.addEventListener('pointerdown', outside, true)
  closeOpen = close
  menu.querySelector<HTMLElement>('.swatch')?.focus()
}
