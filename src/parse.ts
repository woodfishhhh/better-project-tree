// Validates what the `orca` CLI and the plugin host answer. Both are outside this plugin, so every
// field is checked before use and a malformed entry is dropped instead of breaking the tree.
import type { RepoInfo, WorktreeInfo } from './types'

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function bool(value: unknown): boolean {
  return value === true
}

/** The `result` of a `--json` CLI answer, or null when it is not a successful one. */
export function cliResult(stdout: string): Json | null {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!isObject(parsed) || parsed.ok !== true || !isObject(parsed.result)) return null
    return parsed.result
  } catch {
    return null
  }
}

export function parseRepo(value: unknown): RepoInfo | null {
  if (!isObject(value)) return null
  const id = str(value.id)
  const path = str(value.path)
  if (!id || !path) return null
  return {
    id,
    path,
    name: str(value.displayName) ?? path.split(/[\\/]/).pop() ?? path,
    kind: value.kind === 'folder' ? 'folder' : 'git'
  }
}

export function parseCliWorktree(value: unknown): WorktreeInfo | null {
  if (!isObject(value)) return null
  const id = str(value.id)
  const repoId = str(value.repoId)
  const path = str(value.path)
  if (!id || !repoId || !path) return null
  return {
    id,
    repoId,
    path,
    name: str(value.displayName) ?? str(value.branch) ?? path,
    branch: str(value.branch),
    isMain: bool(value.isMainWorktree),
    parentId: str(value.parentWorktreeId),
    unread: bool(value.isUnread),
    pinned: bool(value.isPinned),
    archived: bool(value.isArchived)
  }
}

export function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.map(parse).filter((item): item is T => item !== null)
}

/** One entry of the host's `workspace.list`. Its ids look like `<projectId>::<path>`. */
export interface HostWorkspace {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly branch: string | null
  readonly kind: 'worktree' | 'folder'
}

export function parseHostWorkspace(value: unknown): HostWorkspace | null {
  if (!isObject(value)) return null
  const id = str(value.id)
  const path = str(value.path)
  if (!id || !path) return null
  return {
    id,
    path,
    name: str(value.name) ?? path,
    branch: str(value.branch),
    kind: value.kind === 'folder' ? 'folder' : 'worktree'
  }
}

const ID_SEPARATOR = '::'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/**
 * Rebuilds projects from the host's workspace list alone, for when the CLI cannot be run. The
 * project's own folder is taken to be the shortest workspace path; lineage and unread state are
 * not available this way.
 */
export function fromHostWorkspaces(workspaces: readonly HostWorkspace[]): {
  repos: RepoInfo[]
  worktrees: WorktreeInfo[]
} {
  const byRepo = new Map<string, HostWorkspace[]>()
  for (const workspace of workspaces) {
    const cut = workspace.id.indexOf(ID_SEPARATOR)
    const repoId = cut > 0 ? workspace.id.slice(0, cut) : workspace.id
    byRepo.set(repoId, [...(byRepo.get(repoId) ?? []), workspace])
  }
  const repos: RepoInfo[] = []
  const worktrees: WorktreeInfo[] = []
  for (const [repoId, members] of byRepo) {
    const root = [...members].sort((a, b) => a.path.length - b.path.length)[0]
    repos.push({ id: repoId, path: root.path, name: basename(root.path), kind: root.kind === 'folder' ? 'folder' : 'git' })
    for (const member of members) {
      worktrees.push({
        id: member.id,
        repoId,
        path: member.path,
        name: member.name,
        branch: member.branch,
        isMain: member === root,
        parentId: null,
        unread: false,
        pinned: false,
        archived: false
      })
    }
  }
  return { repos, worktrees }
}
