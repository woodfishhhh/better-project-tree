// The panel's few strings, in English and Chinese; Orca's UI language picks one.

const EN = {
  filter: 'Filter projects',
  refresh: 'Refresh',
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',
  toggleSidebar: 'Show or hide Orca’s left sidebar',
  loading: 'Loading projects…',
  empty: 'No projects yet. Add one in Orca’s left sidebar.',
  noMatch: 'Nothing matches the filter.',
  loadFailed: 'Could not load projects',
  openFailed: 'Could not open the workspace',
  hostSource: 'Limited view: the orca CLI was not reachable, so child worktrees and unread marks are hidden.',
  tree: 'Projects'
}

type Strings = typeof EN

const ZH: Strings = {
  filter: '筛选项目',
  refresh: '刷新',
  collapseAll: '全部折叠',
  expandAll: '全部展开',
  toggleSidebar: '显示/隐藏 Orca 原来的左侧边栏',
  loading: '正在加载项目…',
  empty: '还没有项目，先在 Orca 左侧边栏添加一个。',
  noMatch: '没有匹配的项目。',
  loadFailed: '项目加载失败',
  openFailed: '打开工作区失败',
  hostSource: '精简视图：没连上 orca 命令行，子工作区和未读标记不显示。',
  tree: '项目'
}

export function strings(locale: string): Strings {
  return locale.toLowerCase().startsWith('zh') ? ZH : EN
}
