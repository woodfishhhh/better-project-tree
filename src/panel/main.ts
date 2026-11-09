// The panel: a VS Code-style project tree with indent guides. Orca wraps this module in a page.
import type {} from 'orca/frame'
import '../protocol'
import type { ProjectTree, TreeNode } from '../types'
import { strings } from './i18n'
import { icon, type IconName } from './icons'
import {
  activeGuideKey,
  containerKeys,
  focusedWorkspaceId,
  navigate,
  pathTo,
  visibleRows,
  type FocusedWorkspace,
  type NavKey,
  type Row
} from './rows'
import { CSS } from './style'
import { renderMessage, renderRows } from './view'

const COLLAPSED_KEY = 'collapsed'
const RELOAD_DEBOUNCE_MS = 400

interface State {
  readonly tree: ProjectTree | null
  readonly error: string | null
  readonly collapsed: ReadonlySet<string>
  readonly filter: string
  readonly selectedKey: string | null
  readonly currentWorkspaceId: string | null
  readonly focused: FocusedWorkspace | null
}

const t = strings(orca.locale)
let state: State = {
  tree: null,
  error: null,
  collapsed: new Set(),
  filter: '',
  selectedKey: null,
  currentWorkspaceId: null,
  focused: null
}
let rows: Row[] = []

// ---------------------------------------------------------------- page

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
const search = document.createElement('input')
search.className = 'search'
search.type = 'search'
search.placeholder = t.filter
search.setAttribute('aria-label', t.filter)
const treeEl = document.createElement('div')
treeEl.className = 'tree'
treeEl.tabIndex = 0
treeEl.setAttribute('role', 'tree')
treeEl.setAttribute('aria-label', t.tree)
const footer = document.createElement('div')
footer.className = 'footer'

function toolButton(name: IconName, label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'tool'
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.appendChild(icon(name))
  button.addEventListener('click', onPress)
  return button
}

toolbar.append(
  search,
  toolButton('refresh', t.refresh, () => void reload()),
  toolButton('collapseAll', t.collapseAll, () => setCollapsed(new Set(containerKeys(state.tree?.nodes ?? [])))),
  toolButton('expandAll', t.expandAll, () => setCollapsed(new Set())),
  toolButton('sidebar', t.toggleSidebar, () => void toggleSidebar())
)
document.body.append(toolbar, treeEl, footer)

// ---------------------------------------------------------------- state

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function render(): void {
  footer.textContent = state.tree?.source === 'host' ? t.hostSource : ''
  if (!state.tree) {
    renderMessage(treeEl, state.error ? `${t.loadFailed}: ${state.error}` : t.loading, state.error !== null)
    return
  }
  rows = visibleRows(state.tree.nodes, state.collapsed, state.filter)
  if (rows.length === 0) {
    renderMessage(treeEl, state.filter ? t.noMatch : t.empty)
    return
  }
  renderRows(treeEl, rows, {
    selectedKey: state.selectedKey,
    currentWorkspaceId: state.currentWorkspaceId,
    activeGuideKey: activeGuideKey(rows, state.selectedKey)
  })
}

function setState(next: Partial<State>): void {
  state = { ...state, ...next }
  render()
}

function setCollapsed(collapsed: ReadonlySet<string>): void {
  setState({ collapsed })
  orca.storage.set(COLLAPSED_KEY, [...collapsed]).catch((error: unknown) => {
    setState({ error: errorText(error) })
  })
}

function toggle(key: string, expanded: boolean): void {
  const next = new Set(state.collapsed)
  if (expanded) next.delete(key)
  else next.add(key)
  setCollapsed(next)
}

function findKey(nodes: readonly TreeNode[], predicate: (node: TreeNode) => boolean): string | null {
  for (const node of nodes) {
    if (predicate(node)) return node.key
    const below = findKey(node.children, predicate)
    if (below) return below
  }
  return null
}

/** Marks Orca's focused workspace and opens the folders above it, as VS Code reveals a file. */
function syncFocused(tree: ProjectTree | null, focused: FocusedWorkspace | null): Partial<State> {
  if (!tree) return { focused }
  const currentWorkspaceId = focusedWorkspaceId(tree.nodes, focused, state.currentWorkspaceId)
  if (!currentWorkspaceId || currentWorkspaceId === state.currentWorkspaceId) return { focused, currentWorkspaceId }
  const above = pathTo(tree.nodes, (node) => node.workspaceId === currentWorkspaceId) ?? []
  const collapsed = new Set([...state.collapsed].filter((key) => !above.includes(key)))
  const selectedKey = findKey(tree.nodes, (node) => node.workspaceId === currentWorkspaceId) ?? state.selectedKey
  return { focused, currentWorkspaceId, collapsed, selectedKey }
}

async function reload(): Promise<void> {
  try {
    const tree = await orca.plugin.request('tree.load')
    setState({ tree, error: null, ...syncFocused(tree, state.focused) })
  } catch (error: unknown) {
    setState({ error: errorText(error) })
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | undefined
function reloadSoon(): void {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => void reload(), RELOAD_DEBOUNCE_MS)
}

async function open(workspaceId: string): Promise<void> {
  setState({ currentWorkspaceId: workspaceId })
  try {
    await orca.plugin.request('tree.open', { workspaceId })
  } catch (error: unknown) {
    void orca.host.call('notifications.show', { title: t.openFailed, body: errorText(error) }).catch(() => undefined)
  }
}

async function toggleSidebar(): Promise<void> {
  try {
    await orca.plugin.request('sidebar.toggle')
  } catch (error: unknown) {
    setState({ error: errorText(error) })
  }
}

/** Pressing a row: open its workspace, or open/close a folder. */
function activate(row: Row): void {
  setState({ selectedKey: row.node.key })
  if (row.node.workspaceId) void open(row.node.workspaceId)
  else if (row.expandable) toggle(row.node.key, !row.expanded)
}

// ---------------------------------------------------------------- input

treeEl.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null
  const rowEl = target?.closest<HTMLElement>('.row')
  const row = rows.find((candidate) => candidate.node.key === rowEl?.dataset.key)
  if (!row) return
  if (target?.closest('.twistie') && row.expandable) {
    setState({ selectedKey: row.node.key })
    toggle(row.node.key, !row.expanded)
    return
  }
  activate(row)
})

const NAV_KEYS: Record<string, NavKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end'
}

treeEl.addEventListener('keydown', (event) => {
  const nav = NAV_KEYS[event.key]
  if (nav) {
    event.preventDefault()
    const result = navigate(rows, state.selectedKey, nav)
    setState({ selectedKey: result.selectedKey })
    if (result.toggle) toggle(result.toggle.key, result.toggle.expanded)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    const row = rows.find((candidate) => candidate.node.key === state.selectedKey)
    if (row) {
      event.preventDefault()
      activate(row)
    }
  }
})

search.addEventListener('input', () => setState({ filter: search.value }))
search.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    treeEl.focus()
    setState({ selectedKey: state.selectedKey ?? rows[0]?.node.key ?? null })
  } else if (event.key === 'Escape') {
    search.value = ''
    setState({ filter: '' })
  }
})

// ---------------------------------------------------------------- start

orca.on('workspace.changed', ({ context }) => {
  const focused = context ? { displayName: context.displayName, branch: context.branch } : null
  setState(syncFocused(state.tree, focused))
  reloadSoon()
})
orca.on('workspace.created', reloadSoon)
orca.on('workspace.removed', reloadSoon)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadSoon()
})

async function start(): Promise<void> {
  render()
  try {
    const stored = await orca.storage.get(COLLAPSED_KEY)
    const keys = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    state = { ...state, collapsed: new Set(keys) }
  } catch (error: unknown) {
    state = { ...state, error: errorText(error) }
  }
  await reload()
}

void start()
