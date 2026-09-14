import type {
  CuriosityEpisode,
  CuriosityNotebookCollection,
  CuriosityNotebookConfig,
} from './contracts';

export interface CuriosityNotebookConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CuriosityCollectionSignals {
  wonderCounts?: Readonly<Record<string, number>>;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function validateCuriosityNotebookConfig(
  config: CuriosityNotebookConfig,
  episodes: readonly CuriosityEpisode[],
): CuriosityNotebookConfigValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const episodeIds = new Set(episodes.map((episode) => episode.id));

  for (const collection of config.collections) {
    if (!nonEmpty(collection.id)) errors.push('collection.id must be non-empty');
    if (!nonEmpty(collection.slug)) errors.push(`${collection.id}.slug must be non-empty`);
    if (ids.has(collection.id)) errors.push(`duplicate collection id "${collection.id}"`);
    if (slugs.has(collection.slug)) errors.push(`duplicate collection slug "${collection.slug}"`);
    ids.add(collection.id);
    slugs.add(collection.slug);

    if (collection.kind === 'editorial') {
      for (const episodeId of collection.episodeIds) {
        if (!episodeIds.has(episodeId)) errors.push(`${collection.id} references missing episode "${episodeId}"`);
      }
    }

    if (collection.kind === 'ranking') {
      if (collection.minimumCount !== undefined && collection.minimumCount < 0) {
        errors.push(`${collection.id}.minimumCount must be zero or greater`);
      }
      if (collection.limit !== undefined && collection.limit < 1) {
        errors.push(`${collection.id}.limit must be at least 1`);
      }
    }
  }

  if (!config.collections.some((collection) => collection.slug === config.defaultCollectionSlug)) {
    errors.push(`default collection "${config.defaultCollectionSlug}" does not exist`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidCuriosityNotebookConfig(
  config: CuriosityNotebookConfig,
  episodes: readonly CuriosityEpisode[],
): CuriosityNotebookConfig {
  const result = validateCuriosityNotebookConfig(config, episodes);
  if (!result.valid) throw new Error(`Invalid Curiosity Notebook config:\n${result.errors.join('\n')}`);
  return config;
}

export function visibleCuriosityNotebookCollections(
  config: CuriosityNotebookConfig,
): CuriosityNotebookCollection[] {
  return [...config.collections].filter((collection) => collection.visible).sort((a, b) => a.order - b.order);
}

export function findCuriosityNotebookCollection(
  config: CuriosityNotebookConfig,
  slug: string,
): CuriosityNotebookCollection | null {
  return config.collections.find((collection) => collection.slug === slug) ?? null;
}

export function episodesForCuriosityNotebookCollection(
  collection: CuriosityNotebookCollection,
  episodes: readonly CuriosityEpisode[],
  signals: CuriosityCollectionSignals = {},
): CuriosityEpisode[] {
  const published = episodes.filter((episode) => episode.status === 'published');

  switch (collection.kind) {
    case 'editorial': {
      const byId = new Map(published.map((episode) => [episode.id, episode]));
      return collection.episodeIds.flatMap((id) => {
        const episode = byId.get(id);
        return episode ? [episode] : [];
      });
    }
    case 'topic':
      return published.filter((episode) => {
        if (collection.scopes && !collection.scopes.includes(episode.scope)) return false;
        const matches = collection.topics.map((topic) => episode.topics.includes(topic));
        return collection.match === 'all' ? matches.every(Boolean) : matches.some(Boolean);
      });
    case 'host':
      return published.filter((episode) => (
        (episode.scope === 'local' && episode.siteId === collection.hostId)
        || episode.hostRefs?.some((ref) => ref.domain === 'site' && ref.id === collection.hostId)
      ));
    case 'provenance':
      return published.filter((episode) => collection.originTypes.includes(episode.origin.type));
    case 'answer-state':
      return published.filter((episode) => collection.answerStatuses.includes(episode.answerStatus));
    case 'ranking': {
      const wonderCounts = signals.wonderCounts;
      if (!wonderCounts) return [];
      const minimumCount = collection.minimumCount ?? 1;
      const ranked = published
        .filter((episode) => (wonderCounts[episode.id] ?? 0) >= minimumCount)
        .sort((a, b) => (wonderCounts[b.id] ?? 0) - (wonderCounts[a.id] ?? 0));
      return collection.limit ? ranked.slice(0, collection.limit) : ranked;
    }
  }
}
