// The panel <-> worker contract, declared once: the panel and src/worker.ts both read it.
import type { ProjectTree } from './types'

export {}

declare module 'orca' {
  interface PluginRequests {
    /** Every project and workspace, as a folder tree. */
    'tree.load': { output: ProjectTree }
    /** Shows a workspace in Orca, as clicking it in the left sidebar does. */
    'tree.open': { input: { workspaceId: string }; output: { opened: boolean } }
    /** Shows or hides Orca's own left sidebar. */
    'sidebar.toggle': { output: { ran: boolean } }
  }
}
