import { useMemo, useRef } from 'react';
import { Puck, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import type {
  BuilderAction,
  BuilderDocument,
  BuilderSiteIdentity,
} from '../../contracts';
import type { HomepageBuilderProviders } from '../../providers';
import {
  builderDocumentToPuckData,
  puckDataToBuilderDocument,
} from './adapter';
import { createHomepagePuckConfig } from './config';
import type { HomepagePuckComponents } from './types';

export interface HomepagePuckEditorProofProps {
  document: BuilderDocument;
  locale: string;
  site: BuilderSiteIdentity;
  providers: HomepageBuilderProviders;
  onAction?: (action: BuilderAction) => void;
  onDocumentChange?: (document: BuilderDocument) => void;
  onApplyDraft?: (document: BuilderDocument) => void | Promise<void>;
  onAdapterError?: (issues: string[]) => void;
  height?: string | number;
}

export function HomepagePuckEditorProof({
  document,
  locale,
  site,
  providers,
  onAction,
  onDocumentChange,
  onApplyDraft,
  onAdapterError,
  height = '100vh',
}: HomepagePuckEditorProofProps) {
  const documentRef = useRef(document);
  const initialData = useMemo(
    () => builderDocumentToPuckData(document, locale, site.defaultLocale),
    [document, locale, site.defaultLocale],
  );

  const config = useMemo(
    () =>
      createHomepagePuckConfig({
        document,
        locale,
        site,
        providers,
        onAction,
      }),
    [document, locale, site, providers, onAction],
  );

  const convert = (data: Data) => {
    const result = puckDataToBuilderDocument(data, documentRef.current, locale, {
      supportedLocales: site.supportedLocales,
    });

    if (!result.ok) {
      onAdapterError?.(result.issues);
      return null;
    }

    documentRef.current = result.document;
    return result.document;
  };

  return (
    <Puck<HomepagePuckComponents>
      config={config}
      data={initialData}
      height={height}
      headerTitle={`JOKO Homepage Builder — ${site.name}`}
      dictionary={{ 'header-publish': 'Apply Draft' }}
      permissions={{ insert: false, delete: false, duplicate: false }}
      viewports={[{ width: 1440 }, { width: 768 }, { width: 375 }]}
      onChange={(data) => {
        const nextDocument = convert(data);
        if (nextDocument) onDocumentChange?.(nextDocument);
      }}
      onPublish={async (data) => {
        const nextDocument = convert(data);
        if (nextDocument) await onApplyDraft?.(nextDocument);
      }}
    />
  );
}
