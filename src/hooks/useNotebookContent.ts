import { useEffect, useState } from 'react';
import {
  getDefaultResolvedNotebookContent,
  getNotebookContent,
  type ResolvedNotebookContent,
} from '../lib/notebookContent';

export function useNotebookContent(): ResolvedNotebookContent {
  const [content, setContent] = useState<ResolvedNotebookContent>(() => getDefaultResolvedNotebookContent());

  useEffect(() => {
    let active = true;
    void getNotebookContent().then((next) => {
      if (active) setContent(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return content;
}
