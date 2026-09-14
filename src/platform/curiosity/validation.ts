import {
  CURIOSITY_SCHEMA_VERSION,
  type CuriosityEpisode,
  type CuriosityFixtureBundle,
  type CuriosityLocalizedText,
} from './contracts';

function assertNonEmpty(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must not be empty`);
}

function assertLocalizedText(
  value: CuriosityLocalizedText,
  locales: readonly string[],
  label: string,
): void {
  for (const locale of locales) {
    const text = value[locale];
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error(`${label}.${locale} must be a non-empty string`);
    }
  }
}

function assertEpisode(
  episode: CuriosityEpisode,
  bundle: CuriosityFixtureBundle,
  ids: Set<string>,
  slugs: Set<string>,
): void {
  if (episode.schemaVersion !== CURIOSITY_SCHEMA_VERSION) {
    throw new Error(`Curiosity ${episode.id} uses an unsupported schema version`);
  }

  assertNonEmpty(episode.id, 'episode.id');
  assertNonEmpty(episode.slug, `episode(${episode.id}).slug`);

  if (ids.has(episode.id)) throw new Error(`Duplicate curiosity id: ${episode.id}`);
  if (slugs.has(episode.slug)) throw new Error(`Duplicate curiosity slug: ${episode.slug}`);
  ids.add(episode.id);
  slugs.add(episode.slug);

  if (episode.scope === 'local') {
    if (!episode.siteId) throw new Error(`Local curiosity ${episode.id} requires siteId`);
    if (episode.siteId !== bundle.site.siteId) {
      throw new Error(`Local curiosity ${episode.id} must belong to ${bundle.site.siteId}`);
    }
  }

  assertLocalizedText(episode.question, bundle.site.supportedLocales, `episode(${episode.id}).question`);
  assertLocalizedText(episode.summary, bundle.site.supportedLocales, `episode(${episode.id}).summary`);

  if (episode.shortAnswer) {
    assertLocalizedText(episode.shortAnswer, bundle.site.supportedLocales, `episode(${episode.id}).shortAnswer`);
  }
  if (episode.fullAnswer) {
    assertLocalizedText(episode.fullAnswer, bundle.site.supportedLocales, `episode(${episode.id}).fullAnswer`);
  }

  if (episode.steps) {
    if (episode.steps.length === 0) {
      throw new Error(`Curiosity ${episode.id} steps must not be empty`);
    }
    const stepIds = new Set<string>();
    for (const step of episode.steps) {
      assertNonEmpty(step.id, `episode(${episode.id}).step.id`);
      if (stepIds.has(step.id)) {
        throw new Error(`Curiosity ${episode.id} has duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);
      assertLocalizedText(step.title, bundle.site.supportedLocales, `step(${step.id}).title`);
      assertLocalizedText(step.body, bundle.site.supportedLocales, `step(${step.id}).body`);
    }
  }

  if (episode.answerStatus === 'answered' && !episode.shortAnswer && !episode.fullAnswer && !episode.steps?.length) {
    throw new Error(`Answered curiosity ${episode.id} requires answer content`);
  }

  if (episode.status === 'published' && !episode.publishedAt) {
    throw new Error(`Published curiosity ${episode.id} requires publishedAt`);
  }

  if (episode.topics.length === 0) {
    throw new Error(`Curiosity ${episode.id} requires at least one topic`);
  }

  for (const topic of episode.topics) assertNonEmpty(topic, `episode(${episode.id}).topic`);

  for (const source of episode.sources ?? []) {
    assertNonEmpty(source.id, `episode(${episode.id}).source.id`);
    assertLocalizedText(source.title, bundle.site.supportedLocales, `source(${source.id}).title`);
  }

  if (episode.guide) {
    assertNonEmpty(episode.guide.id, `episode(${episode.id}).guide.id`);
    assertLocalizedText(episode.guide.name, bundle.site.supportedLocales, `guide(${episode.guide.id}).name`);
  }

  if (episode.heroMedia) {
    assertNonEmpty(episode.heroMedia.id, `episode(${episode.id}).heroMedia.id`);
    assertLocalizedText(
      episode.heroMedia.alt,
      bundle.site.supportedLocales,
      `media(${episode.heroMedia.id}).alt`,
    );
  }
}

export function assertValidCuriosityFixtureBundle<T extends CuriosityFixtureBundle>(bundle: T): T {
  if (bundle.schemaVersion !== CURIOSITY_SCHEMA_VERSION) {
    throw new Error(`Unsupported Curiosity bundle schema version: ${bundle.schemaVersion}`);
  }

  assertNonEmpty(bundle.site.siteId, 'site.siteId');
  assertNonEmpty(bundle.site.siteKey, 'site.siteKey');

  if (bundle.site.supportedLocales.length === 0) {
    throw new Error('site.supportedLocales must not be empty');
  }
  if (!bundle.site.supportedLocales.includes(bundle.site.defaultLocale)) {
    throw new Error('site.defaultLocale must be included in site.supportedLocales');
  }

  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const episode of bundle.episodes) assertEpisode(episode, bundle, ids, slugs);

  for (const episode of bundle.episodes) {
    for (const relation of episode.related ?? []) {
      if (!ids.has(relation.curiosityId)) {
        throw new Error(`Curiosity ${episode.id} references unknown related curiosity ${relation.curiosityId}`);
      }
      if (relation.curiosityId === episode.id) {
        throw new Error(`Curiosity ${episode.id} cannot relate to itself`);
      }
    }
  }

  return bundle;
}
