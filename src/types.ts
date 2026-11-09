// Shapes shared by the worker (which builds the tree) and the panel (which draws it).

/** A project Orca knows: a Git repository or a plain folder. */
export interface RepoInfo {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly kind: 'git' | 'folder'
}

/** One workspace (a Git worktree or a folder) inside a project. */
export interface WorktreeInfo {
  readonly id: string
  readonly repoId: string
  readonly name: string
  readonly path: string
  readonly branch: string | null
  readonly isMain: boolean
  readonly parentId: string | null
  readonly unread: boolean
  readonly pinned: boolean
  readonly archived: boolean
}

export type TreeNodeKind = 'folder' | 'repo' | 'home' | 'worktree'

export interface TreeNode {
  /** Stable across reloads, so expansion state survives a refresh. */
  readonly key: string
  readonly kind: TreeNodeKind
  readonly label: string
  /** Secondary text, such as the branch of a single-worktree project. */
  readonly detail: string | null
  readonly path: string
  /** Set when pressing the row should open a workspace. */
  readonly workspaceId: string | null
  /** The workspace's own name and branch, to recognise it as the focused one. */
  readonly workspaceName: string | null
  readonly branch: string | null
  readonly unread: boolean
  readonly children: readonly TreeNode[]
}

export interface ProjectTree {
  readonly nodes: readonly TreeNode[]
  /** Where the data came from: the full `orca` CLI, or the plugin host's workspace list only. */
  readonly source: 'cli' | 'host'
  readonly loadedAt: number
}
