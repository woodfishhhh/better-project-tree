import { assert, test } from 'orca/testing'
import type { TreeNode } from '../types'
import { activeGuideKey, containerKeys, focusedWorkspaceId, navigate, pathTo, visibleRows } from './rows'

function node(key: string, children: TreeNode[] = [], fields: Partial<TreeNode> = {}): TreeNode {
  return {
    key,
    kind: children.length > 0 ? 'folder' : 'worktree',
    label: key,
    detail: null,
    path: `/${key}`,
    workspaceId: children.length > 0 ? null : `ws-${key}`,
    workspaceName: children.length > 0 ? null : key,
    branch: null,
    unread: false,
    children,
    ...fields
  }
}

// work/
//   audio/
//     asr
//     tts
//   ana
// home
const tree = [node('work', [node('audio', [node('asr'), node('tts')]), node('ana')]), node('home')]
const keys = (rows: ReturnType<typeof visibleRows>): string[] => rows.map((row) => row.node.key)

test('rows follow the tree, with depth and the guides above each row', () => {
  const rows = visibleRows(tree, new Set())
  assert.deepEqual(keys(rows), ['work', 'audio', 'asr', 'tts', 'ana', 'home'])
  assert.deepEqual(
    rows.map((row) => [row.depth, row.ancestors.join('>')]),
    [[0, ''], [1, 'work'], [2, 'work>audio'], [2, 'work>audio'], [1, 'work'], [0, '']]
  )
})

test('a collapsed container hides what it holds', () => {
  const rows = visibleRows(tree, new Set(['audio']))
  assert.deepEqual(keys(rows), ['work', 'audio', 'ana', 'home'])
  assert.equal(rows[1].expanded, false)
  assert.equal(rows[1].expandable, true)
})

test('a filter shows matches with the folders above them, even collapsed ones', () => {
  assert.deepEqual(keys(visibleRows(tree, new Set(['work', 'audio']), 'TT')), ['work', 'audio', 'tts'])
  assert.deepEqual(keys(visibleRows(tree, new Set(), 'audio')), ['work', 'audio', 'asr', 'tts'])
  assert.deepEqual(keys(visibleRows(tree, new Set(), 'nothing')), [])
})

test('the highlighted guide is the selected row’s container, or its own when open', () => {
  const rows = visibleRows(tree, new Set())
  assert.equal(activeGuideKey(rows, 'asr'), 'audio')
  assert.equal(activeGuideKey(rows, 'audio'), 'audio')
  assert.equal(activeGuideKey(rows, 'home'), null)
  assert.equal(activeGuideKey(visibleRows(tree, new Set(['audio'])), 'audio'), 'work')
  assert.equal(activeGuideKey(rows, 'missing'), null)
})

test('arrow keys move like VS Code’s explorer', () => {
  const rows = visibleRows(tree, new Set())
  assert.deepEqual(navigate(rows, 'asr', 'down'), { selectedKey: 'tts', toggle: null })
  assert.deepEqual(navigate(rows, 'work', 'up'), { selectedKey: 'work', toggle: null })
  assert.deepEqual(navigate(rows, 'asr', 'left'), { selectedKey: 'audio', toggle: null })
  assert.deepEqual(navigate(rows, 'audio', 'left'), { selectedKey: 'audio', toggle: { key: 'audio', expanded: false } })
  assert.deepEqual(navigate(rows, 'audio', 'right'), { selectedKey: 'asr', toggle: null })
  assert.deepEqual(navigate(rows, 'home', 'left'), { selectedKey: 'home', toggle: null })
  assert.deepEqual(navigate(rows, null, 'down'), { selectedKey: 'work', toggle: null })
  assert.deepEqual(navigate(rows, 'asr', 'end'), { selectedKey: 'home', toggle: null })
  const closed = visibleRows(tree, new Set(['audio']))
  assert.deepEqual(navigate(closed, 'audio', 'right'), { selectedKey: 'audio', toggle: { key: 'audio', expanded: true } })
  assert.deepEqual(navigate([], 'x', 'down'), { selectedKey: null, toggle: null })
})

test('the focused workspace is matched by name and branch, only when unique', () => {
  const twins = [node('a', [], { workspaceName: 'main', branch: 'main' }), node('b', [], { workspaceName: 'main', branch: 'main' })]
  const named = [...twins, node('c', [], { workspaceName: 'fix', branch: 'fix/x' })]
  assert.equal(focusedWorkspaceId(named, { displayName: 'fix', branch: 'refs/heads/fix/x' }, null), 'ws-c')
  assert.equal(focusedWorkspaceId(named, { displayName: 'main', branch: 'main' }, null), null)
  assert.equal(focusedWorkspaceId(named, { displayName: 'main', branch: 'main' }, 'ws-b'), 'ws-b')
  assert.equal(focusedWorkspaceId(named, { displayName: 'main', branch: 'main' }, 'ws-c'), null)
  assert.equal(focusedWorkspaceId(named, null, 'ws-c'), null)
})

test('pathTo and containerKeys', () => {
  assert.deepEqual(pathTo(tree, (candidate) => candidate.key === 'tts'), ['work', 'audio'])
  assert.deepEqual(pathTo(tree, (candidate) => candidate.key === 'home'), [])
  assert.equal(pathTo(tree, () => false), null)
  assert.deepEqual(containerKeys(tree), ['work', 'audio'])
})
