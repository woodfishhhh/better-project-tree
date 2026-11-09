// Small line icons in the style of VS Code's codicons, built as SVG elements (never from strings
// that hold data, so labels can never inject markup).
import type { TreeNodeKind } from '../types'

const SVG_NS = 'http://www.w3.org/2000/svg'

const PATHS = {
  chevron: ['M6 4l4 4-4 4'],
  folder: ['M1.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3.5h-4a1 1 0 0 0-1 1z'],
  folderOpen: ['M1.5 12.5V4.5a1 1 0 0 1 1-1h4L8 5h4.5a1 1 0 0 1 1 1v1', 'M1.5 12.5l2-5h11l-2 5z'],
  repo: ['M3.5 2.5h9v9h-9a1.5 1.5 0 0 0 0 3h9', 'M3.5 2.5a1.5 1.5 0 0 0-1.5 1.5v9', 'M6 5.5h4'],
  home: ['M2 7.5L8 2.5l6 5', 'M3.5 6.5v7h3.5v-4h2v4h3.5v-7'],
  branch: ['M5 3v10', 'M5 10c0-3 6-2 6-5'],
  branchDots: ['M5 3a1.2 1.2 0 1 0 0 .01', 'M5 13a1.2 1.2 0 1 0 0 .01', 'M11 5a1.2 1.2 0 1 0 0 .01'],
  refresh: ['M13 3v3.5H9.5', 'M13 6.5A5.5 5.5 0 1 0 13.5 9'],
  collapseAll: ['M3 3.5h10v10H3z', 'M5.5 8.5h5'],
  expandAll: ['M3 3.5h10v10H3z', 'M5.5 8.5h5', 'M8 6v5'],
  sidebar: ['M2 3h12v10H2z', 'M6 3v10']
} as const

export type IconName = keyof typeof PATHS

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const parts: readonly string[] = name === 'branch' ? [...PATHS.branch, ...PATHS.branchDots] : PATHS[name]
  for (const d of parts) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
  }
  return svg
}

export function kindIcon(kind: TreeNodeKind, expanded: boolean): SVGSVGElement {
  if (kind === 'folder') return icon(expanded ? 'folderOpen' : 'folder')
  if (kind === 'home') return icon('home')
  if (kind === 'repo') return icon('repo')
  return icon('branch')
}
