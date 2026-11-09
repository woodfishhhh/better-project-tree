import { assert, test } from 'orca/testing'
import { buildTree, displayPath, shortBranch, splitPath } from './tree'
import type { RepoInfo, TreeNode, WorktreeInfo } from './types'

const HOME = '/Users/me'

function repo(id: string, path: string, kind: RepoInfo['kind'] = 'git'): RepoInfo {
  return { id, name: path === HOME ? '~' : (path.split('/').pop() ?? path), path, kind }
}

function worktree(repoId: string, path: string, fields: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    id: `${repoId}::${path}`,
    repoId,
    name: 'main',
    path,
    branch: 'refs/heads/main',
    isMain: true,
    parentId: null,
    unread: false,
    pinned: false,
    archived: false,
    ...fields
  }
}

/** The tree as indented lines: two spaces per level, then the label and any detail. */
function outline(nodes: readonly TreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${'  '.repeat(depth)}${node.label}${node.detail ? ` (${node.detail})` : ''}`,
    ...outline(node.children, depth + 1)
  ])
}

const work = `${HOME}/Desktop/work`
const audio = `${work}/audio`
const repos = [
  repo('home', HOME, 'folder'),
  repo('ana', `${work}/data-ana`),
  repo('asr', `${audio}/asr-server`),
  repo('tts', `${audio}/tts-server`)
]
const singleWorktrees = [
  worktree('home', HOME, { name: '~', branch: null }),
  worktree('ana', `${work}/data-ana`, { name: 'master', branch: 'refs/heads/master' }),
  worktree('asr', `${audio}/asr-server`, { name: 'maas', branch: 'refs/heads/maas' }),
  worktree('tts', `${audio}/tts-server`)
]

test('groups projects under their shared folders and compacts single-child chains', () => {
  assert.deepEqual(outline(buildTree(repos, singleWorktrees, HOME)), [
    '~/Desktop/work',
    '  audio',
    '    asr-server (maas)',
    '    tts-server (main)',
    '  data-ana (master)',
    '~'
  ])
})

test('a project with one workspace opens it directly', () => {
  const [, home] = buildTree(repos, singleWorktrees, HOME)
  assert.equal(home.kind, 'home')
  assert.equal(home.workspaceId, `home::${HOME}`)
  assert.deepEqual(home.children, [])
})

test('a project with several worktrees lists them, main first, child worktrees nested', () => {
  const root = `${audio}/asr-server`
  const feature = worktree('asr', `${HOME}/orca/workspaces/asr/fix`, {
    name: 'fix',
    branch: 'refs/heads/fix/itn',
    isMain: false
  })
  const child = worktree('asr', `${HOME}/orca/workspaces/asr/fix-child`, {
    name: 'fix-child',
    isMain: false,
    branch: 'refs/heads/fix-child',
    parentId: feature.id,
    unread: true
  })
  const archived = worktree('asr', `${HOME}/orca/workspaces/asr/old`, { name: 'old', isMain: false, archived: true })
  const tree = buildTree([repo('asr', root)], [child, feature, archived, worktree('asr', root)], HOME)
  assert.deepEqual(outline(tree), ['asr-server', '  main', '  fix (fix/itn)', '    fix-child'])
  assert.equal(tree[0].workspaceId, null)
  assert.equal(tree[0].unread, true, 'an unread child marks its project')
})

test('a single project sits at the top level with no folder above it', () => {
  const only = repo('ana', `${work}/data-ana`)
  assert.deepEqual(outline(buildTree([only], [worktree('ana', only.path)], HOME)), ['data-ana (main)'])
})

test('sibling folders under a shared root keep relative labels', () => {
  const tree = buildTree([repo('a', `${work}/x/a`), repo('b', `${work}/y/b`)], [], HOME)
  assert.deepEqual(outline(tree), ['x', '  a', 'y', '  b'])
})

test('keys are stable and unique', () => {
  const keys = (nodes: readonly TreeNode[]): string[] => nodes.flatMap((node) => [node.key, ...keys(node.children)])
  const all = keys(buildTree(repos, singleWorktrees, HOME))
  assert.equal(new Set(all).size, all.length)
  assert.deepEqual(keys(buildTree(repos, singleWorktrees, HOME)), all)
})

test('empty input draws nothing', () => {
  assert.deepEqual(buildTree([], [], HOME), [])
})

test('path helpers', () => {
  assert.deepEqual(splitPath('C:\\code\\repo'), ['C:', 'code', 'repo'])
  assert.equal(shortBranch('refs/heads/feat/x'), 'feat/x')
  assert.equal(shortBranch(null), null)
  assert.equal(displayPath(`${HOME}/a/b`, HOME), '~/a/b')
  assert.equal(displayPath(HOME, HOME), '~')
  assert.equal(displayPath('/opt/x', HOME), '/opt/x')
  assert.equal(displayPath('/Users/meow', HOME), '/Users/meow')
})
