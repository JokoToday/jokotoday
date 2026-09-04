import type { BuilderDocument } from '../../contracts';
import {
  jokoTodayFixtureSite,
  jokoTodayHomepageFixture,
} from '../../fixtures';
import { fixtureHomepageProviders } from '../../providers';
import { HomepagePuckEditorProof } from './HomepagePuckEditorProof';

export interface JokoTodayHomepagePuckFixtureProofProps {
  locale?: 'en' | 'th' | 'zh';
  onDocumentChange?: (document: BuilderDocument) => void;
  onApplyDraft?: (document: BuilderDocument) => void | Promise<void>;
  onAdapterError?: (issues: string[]) => void;
}

export function JokoTodayHomepagePuckFixtureProof({
  locale = 'en',
  onDocumentChange,
  onApplyDraft,
  onAdapterError,
}: JokoTodayHomepagePuckFixtureProofProps) {
  return (
    <HomepagePuckEditorProof
      document={jokoTodayHomepageFixture}
      locale={locale}
      site={jokoTodayFixtureSite}
      providers={fixtureHomepageProviders}
      onDocumentChange={onDocumentChange}
      onApplyDraft={onApplyDraft}
      onAdapterError={onAdapterError}
    />
  );
}
