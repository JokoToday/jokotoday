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
    case 'notebook.index':
      return `/notebook/${target.index}`;
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


function decodeNotebookSlug(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded && decoded !== '.' && decoded !== '..' ? decoded : null;
  } catch {
    return null;
  }
}

export function parseNotebookPath(path: string): NotebookRouteTarget | null {
  if (path === '/notebook/today') return { type: 'notebook.today' };
  if (path === '/notebook/history') return { type: 'notebook.history' };
  if (path === '/notebook/people') return { type: 'notebook.index', index: 'people' };
  if (path === '/notebook/curiosities') return { type: 'notebook.index', index: 'curiosities' };
  if (path === '/notebook/places') return { type: 'notebook.index', index: 'places' };
  if (path === '/notebook/products') return { type: 'notebook.index', index: 'products' };

  const person = path.match(/^\/notebook\/people\/([^/]+)$/);
  if (person) {
    const slug = decodeNotebookSlug(person[1]);
    return slug ? { type: 'notebook.person', slug } : null;
  }

  const product = path.match(/^\/notebook\/products\/([^/]+)$/);
  if (product) {
    const slug = decodeNotebookSlug(product[1]);
    return slug ? { type: 'notebook.product', slug } : null;
  }

  const question = path.match(/^\/notebook\/questions\/([^/]+)$/);
  if (question) {
    const slug = decodeNotebookSlug(question[1]);
    return slug ? { type: 'notebook.question', slug } : null;
  }

  return null;
}
