import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  episodesForCuriosityNotebookCollection,
  type CuriosityEpisode,
  type CuriosityNotebookCollection,
} from '../platform/curiosity';
import {
  loadCuriosityWonderCounts,
  loadPublishedCuriosityCatalog,
} from '../lib/curiosityPersistenceService';

interface UseCuriosityCatalogOptions {
  fallbackEpisodes: readonly CuriosityEpisode[];
}

export interface CuriosityCatalogState {
  episodes: readonly CuriosityEpisode[];
  wonderCounts: Readonly<Record<string, number>>;
  persistenceActive: boolean;
  loading: boolean;
  updateWonderCount: (curiosityId: string, count: number) => void;
}

export function useCuriosityCatalog({ fallbackEpisodes }: UseCuriosityCatalogOptions): CuriosityCatalogState {
  const [episodes, setEpisodes] = useState<readonly CuriosityEpisode[]>(fallbackEpisodes);
  const [wonderCounts, setWonderCounts] = useState<Readonly<Record<string, number>>>({});
  const [persistenceActive, setPersistenceActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void Promise.all([
      loadPublishedCuriosityCatalog().catch((error) => {
        console.error('Could not load persisted Curiosities:', error);
        return null;
      }),
      loadCuriosityWonderCounts(),
    ]).then(([catalog, counts]) => {
      if (!active) return;
      if (catalog) {
        setEpisodes(catalog);
        setPersistenceActive(true);
      } else {
        setEpisodes(fallbackEpisodes);
        setPersistenceActive(false);
      }
      if (counts) setWonderCounts(counts);
      setLoading(false);
    });

    return () => { active = false; };
  }, [fallbackEpisodes]);

  const updateWonderCount = useCallback((curiosityId: string, count: number) => {
    setWonderCounts((current) => ({ ...current, [curiosityId]: Math.max(0, count) }));
  }, []);

  return { episodes, wonderCounts, persistenceActive, loading, updateWonderCount };
}

export function useCuriosityCollectionEpisodes(
  collection: CuriosityNotebookCollection | null,
  catalog: CuriosityCatalogState,
): readonly CuriosityEpisode[] {
  return useMemo(() => (
    collection
      ? episodesForCuriosityNotebookCollection(collection, catalog.episodes, {
          wonderCounts: catalog.wonderCounts,
        })
      : []
  ), [catalog.episodes, catalog.wonderCounts, collection]);
}
