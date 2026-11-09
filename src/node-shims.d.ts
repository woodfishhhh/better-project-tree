// The few Node APIs the worker uses, so `tsc` checks it without installing @types/node.

declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: { timeout?: number; maxBuffer?: number },
    callback: (error: Error | null, stdout: string, stderr: string) => void
  ): unknown
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean
}

declare module 'node:os' {
  export function homedir(): string
}

declare module 'node:path' {
  export function join(...segments: string[]): string
}

declare const process: { readonly execPath: string }
