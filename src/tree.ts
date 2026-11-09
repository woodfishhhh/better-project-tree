// Turns Orca's flat project and workspace lists into a folder tree, the way VS Code's explorer
// shows nested folders: shared parent folders become collapsible nodes, a chain of single-child
// folders is compacted into one row ("~/Desktop/work"), and child worktrees nest under their parent.
import type { RepoInfo, TreeNode, WorktreeInfo } from './types'

const BRANCH_PREFIX = 'refs/heads/'

/** Splits a path into its segments, accepting `/` and `\` separators. */
export function splitPath(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment.length > 0)
}

function joinSegments(segments: readonly string[], absolute: boolean): string {
  const joined = segments.join('/')
  return absolute ? `/${joined}` : joined
}

export function shortBranch(branch: string | null): string | null {
  if (!branch) return null
  return branch.startsWith(BRANCH_PREFIX) ? branch.slice(BRANCH_PREFIX.length) : branch
}

/** Shows a path under the home folder as `~/...`. */
export function displayPath(path: string, home: string | null): string {
  if (!home) return path
  const homeParts = splitPath(home)
  const parts = splitPath(path)
  const underHome = homeParts.every((segment, index) => parts[index] === segment)
  if (!underHome || parts.length < homeParts.length) return path
  const rest = parts.slice(homeParts.length)
  return rest.length === 0 ? '~' : `~/${rest.join('/')}`
}

function byLabel(a: TreeNode, b: TreeNode): number {
  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
}

const KIND_ORDER: Record<TreeNode['kind'], number> = { folder: 0, home: 1, repo: 1, worktree: 2 }

/** Folders first, then projects, each alphabetical: the order VS Code uses. */
function sortNodes(nodes: readonly TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byLabel(a, b))
}

// ---------------------------------------------------------------- worktrees inside one project

function worktreeOrder(a: WorktreeInfo, b: WorktreeInfo): number {
  if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
}

function worktreeDetail(worktree: WorktreeInfo): string | null {
  const branch = shortBranch(worktree.branch)
  return branch && branch !== worktree.name ? branch : null
}

function worktreeNode(worktree: WorktreeInfo, all: readonly WorktreeInfo[]): TreeNode {
  const children = all
    .filter((candidate) => candidate.parentId === worktree.id)
    .sort(worktreeOrder)
    .map((child) => worktreeNode(child, all))
  return {
    key: `wt:${worktree.id}`,
    kind: 'worktree',
    label: worktree.name,
    detail: worktreeDetail(worktree),
    path: worktree.path,
    workspaceId: worktree.id,
    workspaceName: worktree.name,
    branch: shortBranch(worktree.branch),
    unread: worktree.unread,
    children
  }
}

/** Top-level worktrees of a project: those without a parent that is also listed. */
function rootWorktrees(worktrees: readonly WorktreeInfo[]): WorktreeInfo[] {
  const ids = new Set(worktrees.map((worktree) => worktree.id))
  return worktrees.filter((worktree) => !worktree.parentId || !ids.has(worktree.parentId))
}

function hasUnread(nodes: readonly TreeNode[]): boolean {
  return nodes.some((node) => node.unread || hasUnread(node.children))
}

/**
 * A project row. A project with one workspace and no child worktrees is a single row that opens
 * it directly (the branch shows beside the name); otherwise its workspaces are its children.
 */
export function repoNode(repo: RepoInfo, worktrees: readonly WorktreeInfo[], home: string | null): TreeNode {
  const own = worktrees.filter((worktree) => worktree.repoId === repo.id && !worktree.archived)
  const roots = rootWorktrees(own).sort(worktreeOrder)
  const kind = repo.kind === 'folder' && home && displayPath(repo.path, home) === '~' ? 'home' : 'repo'
  const base = { key: `repo:${repo.id}`, kind, label: repo.name, path: repo.path } as const
  const only = roots.length === 1 && own.length === 1 ? roots[0] : undefined
  if (only) {
    const branch = shortBranch(only.branch)
    return {
      ...base,
      detail: branch && branch !== repo.name ? branch : null,
      workspaceId: only.id,
      workspaceName: only.name,
      branch,
      unread: only.unread,
      children: []
    }
  }
  const children = roots.map((worktree) => worktreeNode(worktree, own))
  const container = { detail: null, workspaceId: null, workspaceName: null, branch: null }
  return { ...base, ...container, unread: hasUnread(children), children }
}

// ---------------------------------------------------------------- folders between projects

interface FolderTrie {
  readonly segments: readonly string[]
  readonly folders: ReadonlyMap<string, FolderTrie>
  readonly repos: readonly TreeNode[]
}

function emptyTrie(segments: readonly string[]): FolderTrie {
  return { segments, folders: new Map(), repos: [] }
}

function insertRepo(trie: FolderTrie, rest: readonly string[], repo: TreeNode): FolderTrie {
  if (rest.length === 0) return { ...trie, repos: [...trie.repos, repo] }
  const [head, ...tail] = rest
  const child = trie.folders.get(head) ?? emptyTrie([...trie.segments, head])
  const folders = new Map(trie.folders)
  folders.set(head, insertRepo(child, tail, repo))
  return { ...trie, folders }
}

function commonPrefix(lists: readonly (readonly string[])[]): string[] {
  if (lists.length === 0) return []
  const [first, ...others] = lists
  const prefix: string[] = []
  for (const [index, segment] of first.entries()) {
    if (!others.every((list) => list[index] === segment)) break
    prefix.push(segment)
  }
  return prefix
}

/** Merges a folder that holds exactly one folder and no projects into that folder. */
function compact(trie: FolderTrie): { trie: FolderTrie; skipped: number } {
  let current = trie
  let skipped = 0
  while (current.repos.length === 0 && current.folders.size === 1) {
    current = [...current.folders.values()][0]
    skipped += 1
  }
  return { trie: current, skipped }
}

interface LabelContext {
  readonly absolute: boolean
  readonly home: string | null
  /** True when the hidden shared root lies above the home folder, so top-level rows show `~/...`. */
  readonly rootAboveHome: boolean
}

function folderNodes(trie: FolderTrie, context: LabelContext, topLevel: boolean): TreeNode[] {
  const { absolute, home } = context
  const folders = [...trie.folders.values()].map((child) => {
    const { trie: merged, skipped } = compact(child)
    const path = joinSegments(merged.segments, absolute)
    const ownSegments = merged.segments.slice(merged.segments.length - skipped - 1)
    const label = topLevel && context.rootAboveHome ? displayPath(path, home) : ownSegments.join('/')
    const children = folderNodes(merged, context, false)
    return {
      key: `dir:${path}`,
      kind: 'folder',
      label,
      detail: null,
      path,
      workspaceId: null,
      workspaceName: null,
      branch: null,
      unread: hasUnread(children),
      children
    } satisfies TreeNode
  })
  return sortNodes([...folders, ...trie.repos])
}

function parentSegments(repo: RepoInfo): string[] {
  return splitPath(repo.path).slice(0, -1)
}

/**
 * The whole tree: projects grouped under the folders that contain them. The deepest folder every
 * project shares is not shown, so the top level starts where the projects differ.
 */
export function buildTree(
  repos: readonly RepoInfo[],
  worktrees: readonly WorktreeInfo[],
  home: string | null
): TreeNode[] {
  if (repos.length === 0) return []
  const absolute = repos.some((repo) => repo.path.startsWith('/'))
  const parents = repos.map(parentSegments)
  const root = commonPrefix(parents)
  const trie = repos.reduce(
    (acc, repo, index) => insertRepo(acc, parents[index].slice(root.length), repoNode(repo, worktrees, home)),
    emptyTrie(root)
  )
  const homeParts = home ? splitPath(home) : []
  const rootAboveHome =
    home !== null && root.length < homeParts.length && root.every((segment, index) => homeParts[index] === segment)
  return folderNodes(trie, { absolute, home, rootAboveHome }, true)
}
