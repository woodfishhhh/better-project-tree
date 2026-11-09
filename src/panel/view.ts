// Draws rows into the tree element. Every label goes in through textContent, never as markup.
import { icon, kindIcon } from './icons'
import type { Row } from './rows'
import { BASE_PADDING, INDENT, guideOffset } from './style'

export interface RowMarks {
  readonly selectedKey: string | null
  readonly currentWorkspaceId: string | null
  readonly activeGuideKey: string | null
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = className
  return el
}

function guides(row: Row, activeKey: string | null): HTMLElement[] {
  return row.ancestors.map((ancestor, level) => {
    const guide = element('i', ancestor === activeKey ? 'guide active' : 'guide')
    guide.style.left = `${guideOffset(level)}px`
    return guide
  })
}

function rowElement(row: Row, marks: RowMarks): HTMLElement {
  const { node } = row
  const current = node.workspaceId !== null && node.workspaceId === marks.currentWorkspaceId
  const classes = ['row', `kind-${node.kind}`, current ? 'current' : '', node.key === marks.selectedKey ? 'selected' : '']
  const el = element('div', classes.filter(Boolean).join(' '))
  el.dataset.key = node.key
  el.id = `row-${encodeURIComponent(node.key)}`
  el.setAttribute('role', 'treeitem')
  el.setAttribute('aria-level', String(row.depth + 1))
  el.setAttribute('aria-selected', String(node.key === marks.selectedKey))
  if (row.expandable) el.setAttribute('aria-expanded', String(row.expanded))
  el.style.paddingLeft = `${BASE_PADDING + row.depth * INDENT}px`
  el.title = node.path

  const twistie = element('span', 'twistie')
  if (row.expandable) twistie.appendChild(icon('chevron'))
  const kind = element('span', 'icon')
  kind.appendChild(kindIcon(node.kind, row.expanded))
  const label = element('span', 'label')
  label.textContent = node.label
  el.append(...guides(row, marks.activeGuideKey), twistie, kind, label)

  if (node.detail) {
    const detail = element('span', 'detail')
    detail.textContent = node.detail
    el.appendChild(detail)
  }
  if (node.unread && !row.expanded) el.appendChild(element('span', 'dot'))
  return el
}

export function renderRows(tree: HTMLElement, rows: readonly Row[], marks: RowMarks): void {
  const fragment = document.createDocumentFragment()
  for (const row of rows) fragment.appendChild(rowElement(row, marks))
  tree.replaceChildren(fragment)
  const selected = marks.selectedKey ? tree.querySelector<HTMLElement>(`[data-key="${CSS.escape(marks.selectedKey)}"]`) : null
  if (selected) {
    tree.setAttribute('aria-activedescendant', selected.id)
    selected.scrollIntoView({ block: 'nearest' })
  } else {
    tree.removeAttribute('aria-activedescendant')
  }
}

export function renderMessage(tree: HTMLElement, text: string, isError = false): void {
  const message = element('div', isError ? 'message error' : 'message')
  message.textContent = text
  tree.replaceChildren(message)
}
