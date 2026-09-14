import type { NotebookEntry, NotebookTodayDocument } from '../../notebook';
import type { CuriosityEpisode } from '../contracts';
import { curiosityEpisodeToNotebookQuestion } from '../notebookAdapter';

export interface CuriosityNotebookProof {
  document: NotebookTodayDocument;
  entries: readonly NotebookEntry[];
}

export function buildCuriosityNotebookProof(
  episode: CuriosityEpisode,
  siteId = 'joko-today',
): CuriosityNotebookProof {
  const questionEntry = curiosityEpisodeToNotebookQuestion(episode);
  const answerBody = episode.shortAnswer ?? episode.summary;

  return {
    entries: [questionEntry],
    document: {
      schemaVersion: 1,
      id: `proof-${episode.id}`,
      siteId,
      date: '2026-09-14',
      title: episode.question,
      subtitle: {
        en: 'Curiosity Engine → Notebook adapter',
        th: 'Curiosity Engine → ตัวแปลง Notebook',
        zh: 'Curiosity Engine → Notebook 适配器',
      },
      featuredEntryRefs: [{ kind: 'question', id: questionEntry.id }],
      surfaces: [
        {
          id: `${episode.id}-question`,
          blocks: [
            {
              id: `${episode.id}-question-copy`,
              type: 'text',
              eyebrow: {
                en: 'CURIOSITY NOTEBOOK',
                th: 'CURIOSITY NOTEBOOK',
                zh: 'CURIOSITY NOTEBOOK',
              },
              heading: episode.question,
              body: episode.summary,
            },
          ],
        },
        {
          id: `${episode.id}-answer`,
          blocks: [
            {
              id: `${episode.id}-answer-copy`,
              type: 'text',
              eyebrow: {
                en: 'A FIRST CLUE',
                th: 'เบาะแสแรก',
                zh: '第一个线索',
              },
              body: answerBody,
            },
          ],
        },
      ],
    },
  };
}
