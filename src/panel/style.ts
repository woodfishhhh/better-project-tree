// The panel's stylesheet. Colours come from Orca's theme variables, so it follows light and dark.
// Layout constants mirror VS Code's explorer: 22px rows, a 16px twistie, one guide per level.

export const ROW_HEIGHT = 22
export const INDENT = 14
export const BASE_PADDING = 6
const TWISTIE = 16

/** Where the guide for nesting level `level` is drawn: under the centre of that level's chevron. */
export function guideOffset(level: number): number {
  return BASE_PADDING + level * INDENT + TWISTIE / 2
}

export const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  display: flex;
  flex-direction: column;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: var(--orca-foreground);
  background: var(--orca-background);
  user-select: none;
  overflow: hidden;
}
.toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 8px 6px;
}
.search {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--orca-input);
  border-radius: calc(var(--orca-radius, 6px) - 2px);
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
}
.search:focus { border-color: var(--orca-ring); }
.tool {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--orca-muted-foreground);
  cursor: pointer;
}
.tool:hover { background: var(--orca-accent); color: var(--orca-accent-foreground); }
.tool svg { width: 16px; height: 16px; }
.tree {
  flex: 1;
  overflow: auto;
  padding: 2px 0 12px;
  outline: none;
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  height: ${ROW_HEIGHT}px;
  padding-right: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.row:hover { background: color-mix(in srgb, var(--orca-accent) 55%, transparent); }
.row.current { background: var(--orca-accent); color: var(--orca-accent-foreground); }
.tree:focus-visible .row.selected,
.tree:focus .row.selected { outline: 1px solid var(--orca-ring); outline-offset: -1px; }
.guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--orca-muted-foreground) 30%, transparent);
  pointer-events: none;
}
.guide.active { background: color-mix(in srgb, var(--orca-foreground) 70%, transparent); }
.twistie {
  flex: none;
  display: grid;
  place-items: center;
  width: ${TWISTIE}px;
  height: ${TWISTIE}px;
  color: var(--orca-muted-foreground);
}
.twistie svg { width: 14px; height: 14px; transition: transform 0.1s ease; }
.row[aria-expanded='true'] > .twistie svg { transform: rotate(90deg); }
.icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin: 0 6px 0 2px;
  color: var(--orca-muted-foreground);
}
.icon svg { width: 16px; height: 16px; }
.row.kind-folder .icon { color: #d8a24a; }
.row.kind-repo .icon, .row.kind-home .icon { color: #5b9bd5; }
.row.kind-worktree .icon { color: #9a7fd1; }
.label { overflow: hidden; text-overflow: ellipsis; }
.row.kind-folder .label { font-weight: 600; }
.detail {
  flex: none;
  max-width: 45%;
  margin-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--orca-muted-foreground);
  font-size: 12px;
}
.row.current .detail { color: inherit; opacity: 0.75; }
.dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--orca-primary);
}
.message {
  padding: 16px 12px;
  color: var(--orca-muted-foreground);
  line-height: 1.6;
}
.message.error { color: var(--orca-destructive); }
.footer {
  padding: 4px 10px 6px;
  font-size: 11px;
  color: var(--orca-muted-foreground);
  border-top: 1px solid var(--orca-border);
}
.footer:empty { display: none; }
`
