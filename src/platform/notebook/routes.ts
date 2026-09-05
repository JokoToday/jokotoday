import type { NotebookEntry, NotebookRouteTarget } from './contracts';

function encodeNotebookSlug(slug: string): string {
  const normalized = slug.trim();
  if (!normalized || normalized === '.' || normalized === '..') {
    throw new Error(`Invalid Notebook slug "${slug}"`);
  }
  return encodeURIComponent(normalized);
}

export function getNotebookPath(target: NotebookRouteTarget): string {
  switch (target.type) {
    case 'notebook.today':
      return '/notebook/today';
    case 'notebook.history':
      return '/notebook/history';
    case 'notebook.person':
      return `/notebook/people/${encodeNotebookSlug(target.slug)}`;
    case 'notebook.product':
      return `/notebook/products/${encodeNotebookSlug(target.slug)}`;
    case 'notebook.question':
      return `/notebook/questions/${encodeNotebookSlug(target.slug)}`;
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
