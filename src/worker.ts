// The plugin's worker: loads the project tree for the panel and opens workspaces when a row is
// pressed. Orca transpiles this file when it loads; there is no build step.
import type { OrcaWorkerApi } from 'orca/worker'
import './protocol'
import { loadTree } from './source'

export default function activate(orca: OrcaWorkerApi): void {
  orca.panels.handle('tree.load', () => loadTree(orca))

  orca.panels.handle('tree.open', async ({ workspaceId }) => {
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) throw new Error('workspaceId is required')
    await orca.host.call('workspace.open', { workspaceId })
    return { opened: true }
  })

  orca.panels.handle('sidebar.toggle', async () => {
    await orca.host.call('commands.run', { action: 'sidebar.left.toggle' })
    return { ran: true }
  })
}
