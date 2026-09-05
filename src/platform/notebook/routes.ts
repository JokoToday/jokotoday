import type { NotebookEntry, NotebookRouteTarget } from './contracts';

export function getNotebookPath(target: NotebookRouteTarget): string {
  switch (target.type) {
    case 'notebook.today':
      return '/notebook/today';
    case 'notebook.history':
      return '/notebook/history';
    case 'notebook.person':
      return `/notebook/people/${encodeURIComponent(target.slug)}`;
    case 'notebook.product':
      return `/notebook/products/${encodeURIComponent(target.slug)}`;
    case 'notebook.question':
      return `/notebook/questions/${encodeURIComponent(target.slug)}`;
  }
}

export function getNotebookEntryTarget(entry: NotebookEntry): NotebookRouteTarget {
  switch (entry.kind) {
    case 'person':
      return { type: 'notebook.person', slug: entry.slug };
    case 'product':
      return { type: 'notebook.product', slug: entry.slug };
    case 'question':
      return { type: 'notebook.question', slug: entry.slug };
  }
}
