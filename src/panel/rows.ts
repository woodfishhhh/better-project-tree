// Pure tree-view logic: which rows show, which indent guide is highlighted, where the keyboard
// moves the selection, and which row is the focused workspace. No DOM here, so it is unit-tested.
import { shortBranch } from '../tree'
import type { TreeNode } from '../types'

export interface Row {
  readonly node: TreeNode
  readonly depth: number
  /** Keys of the rows this one sits under, outermost first; one per indent guide. */
  readonly ancestors: readonly string[]
  readonly expandable: boolean
  readonly expanded: boolean
}

function matches(node: TreeNode, needle: string): boolean {
  return [node.label, node.detail, node.workspaceName].some((text) => text?.toLowerCase().includes(needle))
}

/** The node with only the parts that match: a matching node keeps all it holds. */
function prune(node: TreeNode, needle: string): TreeNode | null {
  if (matches(node, needle)) return node
  const children = node.children.map((child) => prune(child, needle)).filter((child): child is TreeNode => !!child)
  return children.length > 0 ? { ...node, children } : null
}

export function filterTree(nodes: readonly TreeNode[], filter: string): readonly TreeNode[] {
  const needle = filter.trim().toLowerCase()
  if (!needle) return nodes
  return nodes.map((node) => prune(node, needle)).filter((node): node is TreeNode => !!node)
}

/**
 * The rows to draw, in order. While a filter is typed every match is shown with the folders that
 * lead to it, whatever was collapsed.
 */
export function visibleRows(nodes: readonly TreeNode[], collapsed: ReadonlySet<string>, filter = ''): Row[] {
  const filtering = filter.trim().length > 0
  const walk = (list: readonly TreeNode[], ancestors: readonly string[]): Row[] =>
    list.flatMap((node) => {
      const expandable = node.children.length > 0
      const expanded = expandable && (filtering || !collapsed.has(node.key))
      const row: Row = { node, depth: ancestors.length, ancestors, expandable, expanded }
      return expanded ? [row, ...walk(node.children, [...ancestors, node.key])] : [row]
    })
  return walk(filterTree(nodes, filter), [])
}

/**
 * The container whose guide is highlighted, as in VS Code: the selected row's own guide when it is
 * an open container, else the guide of the container it sits in.
 */
export function activeGuideKey(rows: readonly Row[], selectedKey: string | null): string | null {
  const row = rows.find((candidate) => candidate.node.key === selectedKey)
  if (!row) return null
  if (row.expanded) return row.node.key
  return row.ancestors[row.ancestors.length - 1] ?? null
}

export type NavKey = 'up' | 'down' | 'left' | 'right' | 'home' | 'end'

export interface NavResult {
  readonly selectedKey: string | null
  /** A container to expand (`right` on a closed one) or collapse (`left` on an open one). */
  readonly toggle: { readonly key: string; readonly expanded: boolean } | null
}

/** Arrow-key behaviour of VS Code's explorer. */
export function navigate(rows: readonly Row[], selectedKey: string | null, key: NavKey): NavResult {
  if (rows.length === 0) return { selectedKey: null, toggle: null }
  const index = rows.findIndex((row) => row.node.key === selectedKey)
  const at = (i: number): NavResult => ({ selectedKey: rows[Math.max(0, Math.min(rows.length - 1, i))].node.key, toggle: null })
  if (index < 0 || key === 'home') return at(0)
  if (key === 'end') return at(rows.length - 1)
  if (key === 'up') return at(index - 1)
  if (key === 'down') return at(index + 1)
  const row = rows[index]
  if (key === 'right') {
    if (!row.expandable) return at(index)
    if (!row.expanded) return { selectedKey: row.node.key, toggle: { key: row.node.key, expanded: true } }
    return at(index + 1)
  }
  if (row.expanded) return { selectedKey: row.node.key, toggle: { key: row.node.key, expanded: false } }
  const parent = row.ancestors[row.ancestors.length - 1]
  return { selectedKey: parent ?? row.node.key, toggle: null }
}

export interface FocusedWorkspace {
  readonly displayName: string
  readonly branch: string
}

function workspaceNodes(nodes: readonly TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [...(node.workspaceId ? [node] : []), ...workspaceNodes(node.children)])
}

/**
 * The workspace Orca has focused. Orca reports only its name and branch, so a match counts only
 * when it is unique; otherwise the previous answer stays if it still fits.
 */
export function focusedWorkspaceId(
  nodes: readonly TreeNode[],
  focused: FocusedWorkspace | null,
  previous: string | null
): string | null {
  if (!focused) return null
  const branch = shortBranch(focused.branch)
  const fits = (node: TreeNode): boolean =>
    node.workspaceName === focused.displayName && (!branch || !node.branch || node.branch === branch)
  const candidates = workspaceNodes(nodes).filter(fits)
  if (candidates.length === 1) return candidates[0].workspaceId
  return candidates.some((node) => node.workspaceId === previous) ? previous : null
}

/** Keys of the containers above a node, so a focused workspace inside a closed folder can be shown. */
export function pathTo(nodes: readonly TreeNode[], predicate: (node: TreeNode) => boolean): string[] | null {
  for (const node of nodes) {
    if (predicate(node)) return []
    const below = pathTo(node.children, predicate)
    if (below) return [node.key, ...below]
  }
  return null
}

export function containerKeys(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? [node.key, ...containerKeys(node.children)] : []))
}
