import type { NotebookQuestionEntry } from '../notebook/contracts';
import type { CuriosityEpisode, CuriosityLocalizedText } from './contracts';

function toNotebookStatus(status: CuriosityEpisode['status']): NotebookQuestionEntry['status'] {
  switch (status) {
    case 'published':
      return 'published';
    case 'archived':
      return 'archived';
    case 'draft':
    case 'researching':
    case 'review':
      return 'draft';
  }
}

function localizedFallback(
  primary: CuriosityLocalizedText | undefined,
  fallback: CuriosityLocalizedText,
): CuriosityLocalizedText {
  return primary ?? fallback;
}

export function curiosityEpisodeToNotebookQuestion(
  episode: CuriosityEpisode,
): NotebookQuestionEntry {
  return {
    id: episode.id,
    kind: 'question',
    slug: episode.slug,
    status: toNotebookStatus(episode.status),
    title: episode.question,
    summary: episode.summary,
    question: episode.question,
    answerTeaser: episode.shortAnswer
      ? localizedFallback(episode.shortAnswer, episode.summary)
      : undefined,
    heroAsset: episode.heroMedia
      ? {
          id: episode.heroMedia.id,
          intent:
            episode.heroMedia.kind === 'photo'
              ? 'photo'
              : episode.heroMedia.kind === 'sketch'
                ? 'sketch'
                : 'illustration',
        }
      : undefined,
  };
}

export function curiosityEpisodesToNotebookQuestions(
  episodes: readonly CuriosityEpisode[],
): NotebookQuestionEntry[] {
  return episodes.map(curiosityEpisodeToNotebookQuestion);
}
