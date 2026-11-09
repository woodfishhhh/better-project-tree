// Loads Orca's projects and workspaces. The `orca` CLI gives the full picture (project names,
// child worktrees, unread marks); the plugin host's `workspace.list` is the fallback when the CLI
// cannot be found or fails.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { OrcaWorkerApi } from 'orca/worker'
import { cliResult, fromHostWorkspaces, parseCliWorktree, parseHostWorkspace, parseList, parseRepo } from './parse'
import { buildTree } from './tree'
import type { ProjectTree, RepoInfo, WorktreeInfo } from './types'

const CLI_TIMEOUT_MS = 15_000
const CLI_MAX_BUFFER = 32 * 1024 * 1024
const MAC_APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'

/** Where the `orca` CLI may live: next to this Orca's executable, the default install, then PATH. */
export function cliCandidates(execPath: string): string[] {
  const appMarker = '.app/Contents/'
  const cut = execPath.indexOf(appMarker)
  const fromApp = cut >= 0 ? join(execPath.slice(0, cut + appMarker.length), 'Resources', 'bin', 'orca') : null
  const candidates = [fromApp, MAC_APP_CLI].filter((path): path is string => path !== null && existsSync(path))
  return [...new Set([...candidates, 'orca'])]
}

function runCli(cli: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cli, [...args, '--json'], { timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_BUFFER }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

async function loadFromCli(cli: string): Promise<{ repos: RepoInfo[]; worktrees: WorktreeInfo[] }> {
  const [repoOut, worktreeOut] = await Promise.all([runCli(cli, ['repo', 'list']), runCli(cli, ['worktree', 'list'])])
  const repoResult = cliResult(repoOut)
  const worktreeResult = cliResult(worktreeOut)
  if (!repoResult || !worktreeResult) throw new Error(`${cli} answered without a result`)
  return {
    repos: parseList(repoResult.repos, parseRepo),
    worktrees: parseList(worktreeResult.worktrees, parseCliWorktree)
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function loadFromHost(orca: OrcaWorkerApi): Promise<{ repos: RepoInfo[]; worktrees: WorktreeInfo[] }> {
  const answer: unknown = await orca.host.call('workspace.list', {})
  const list = typeof answer === 'object' && answer !== null ? (answer as { workspaces?: unknown }).workspaces : null
  return fromHostWorkspaces(parseList(list, parseHostWorkspace))
}

export async function loadTree(orca: OrcaWorkerApi, now: number = Date.now()): Promise<ProjectTree> {
  const home = homedir() || null
  for (const cli of cliCandidates(process.execPath)) {
    try {
      const { repos, worktrees } = await loadFromCli(cli)
      return { nodes: buildTree(repos, worktrees, home), source: 'cli', loadedAt: now }
    } catch (error: unknown) {
      orca.log(`orca CLI at ${cli} failed: ${errorText(error)}`)
    }
  }
  const { repos, worktrees } = await loadFromHost(orca)
  return { nodes: buildTree(repos, worktrees, home), source: 'host', loadedAt: now }
}
