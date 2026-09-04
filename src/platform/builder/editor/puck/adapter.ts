import type { Data } from '@puckeditor/core';
import type {
  BuilderDocument,
  BuilderSection,
  LocalizedText,
} from '../../contracts';
import { validateBuilderDocument } from '../../validation';
import {
  builderTypeToPuckType,
  puckTypeToBuilderType,
  type HomepagePuckComponentType,
} from './types';

interface PuckContentItem {
  type: string;
  props: Record<string, unknown>;
}

export type PuckAdapterResult =
  | { ok: true; document: BuilderDocument }
  | { ok: false; issues: string[] };

export interface PuckAdapterValidationOptions {
  supportedLocales?: readonly string[];
}

function localizedValue(
  value: LocalizedText,
  locale: string,
  fallbackLocale: string,
): string {
  return (
    value[locale] ??
    value[fallbackLocale] ??
    Object.values(value).find((entry) => entry.trim().length > 0) ??
    ''
  );
}

function withLocale(
  value: LocalizedText,
  locale: string,
  nextValue: string,
): LocalizedText {
  return { ...value, [locale]: nextValue };
}

function readString(props: Record<string, unknown>, key: string): string | null {
  return typeof props[key] === 'string' ? props[key] : null;
}

function readBoolean(props: Record<string, unknown>, key: string): boolean | null {
  return typeof props[key] === 'boolean' ? props[key] : null;
}

function readContent(data: Data): PuckContentItem[] {
  if (!Array.isArray(data.content)) return [];
  return data.content as unknown as PuckContentItem[];
}

function baseProps(section: BuilderSection) {
  return {
    id: section.id,
    visible: section.visible,
    width: section.design.width,
    spacing: section.design.spacing,
  };
}

export function builderDocumentToPuckData(
  document: BuilderDocument,
  locale: string,
  fallbackLocale = locale,
): Data {
  const content = document.sections.map((section) => {
    const common = baseProps(section);

    switch (section.type) {
      case 'home.hero.v1':
        return {
          type: builderTypeToPuckType[section.type],
          props: {
            ...common,
            title: localizedValue(section.props.title, locale, fallbackLocale),
            subtitle: localizedValue(section.props.subtitle, locale, fallbackLocale),
            primaryActionLabel: localizedValue(
              section.props.primaryActionLabel,
              locale,
              fallbackLocale,
            ),
            secondaryActionLabel: localizedValue(
              section.props.secondaryActionLabel,
              locale,
              fallbackLocale,
            ),
            mediaAlt: localizedValue(section.props.mediaAlt, locale, fallbackLocale),
          },
        };

      case 'home.top-liked.v1':
        return {
          type: builderTypeToPuckType[section.type],
          props: {
            ...common,
            title: localizedValue(section.props.title, locale, fallbackLocale),
            subtitle: localizedValue(section.props.subtitle, locale, fallbackLocale),
            browseLabel: localizedValue(section.props.browseLabel, locale, fallbackLocale),
          },
        };

      case 'home.category-grid.v1':
        return {
          type: builderTypeToPuckType[section.type],
          props: {
            ...common,
            title: localizedValue(section.props.title, locale, fallbackLocale),
          },
        };

      case 'home.cta.v1':
        return {
          type: builderTypeToPuckType[section.type],
          props: {
            ...common,
            title: localizedValue(section.props.title, locale, fallbackLocale),
            body: localizedValue(section.props.body, locale, fallbackLocale),
            actionLabel: localizedValue(section.props.actionLabel, locale, fallbackLocale),
          },
        };
    }
  });

  return {
    content,
    root: { props: {} },
  } as unknown as Data;
}

export function applyPuckComponentToSection(
  type: string,
  props: Record<string, unknown>,
  baseDocument: BuilderDocument,
  locale: string,
): BuilderSection | null {
  if (!(type in puckTypeToBuilderType)) return null;

  const puckType = type as HomepagePuckComponentType;
  const builderType = puckTypeToBuilderType[puckType];
  const id = readString(props, 'id');
  const visible = readBoolean(props, 'visible');
  const width = readString(props, 'width');
  const spacing = readString(props, 'spacing');

  if (!id || visible === null || !width || !spacing) return null;

  const base = baseDocument.sections.find((section) => section.id === id);
  if (!base || base.type !== builderType) return null;

  const common = {
    ...base,
    visible,
    design: {
      ...base.design,
      width,
      spacing,
    },
  } as BuilderSection;

  switch (common.type) {
    case 'home.hero.v1': {
      const title = readString(props, 'title');
      const subtitle = readString(props, 'subtitle');
      const primaryActionLabel = readString(props, 'primaryActionLabel');
      const secondaryActionLabel = readString(props, 'secondaryActionLabel');
      const mediaAlt = readString(props, 'mediaAlt');
      if (
        title === null ||
        subtitle === null ||
        primaryActionLabel === null ||
        secondaryActionLabel === null ||
        mediaAlt === null
      ) {
        return null;
      }
      return {
        ...common,
        props: {
          ...common.props,
          title: withLocale(common.props.title, locale, title),
          subtitle: withLocale(common.props.subtitle, locale, subtitle),
          primaryActionLabel: withLocale(
            common.props.primaryActionLabel,
            locale,
            primaryActionLabel,
          ),
          secondaryActionLabel: withLocale(
            common.props.secondaryActionLabel,
            locale,
            secondaryActionLabel,
          ),
          mediaAlt: withLocale(common.props.mediaAlt, locale, mediaAlt),
        },
      };
    }

    case 'home.top-liked.v1': {
      const title = readString(props, 'title');
      const subtitle = readString(props, 'subtitle');
      const browseLabel = readString(props, 'browseLabel');
      if (title === null || subtitle === null || browseLabel === null) return null;
      return {
        ...common,
        props: {
          ...common.props,
          title: withLocale(common.props.title, locale, title),
          subtitle: withLocale(common.props.subtitle, locale, subtitle),
          browseLabel: withLocale(common.props.browseLabel, locale, browseLabel),
        },
      };
    }

    case 'home.category-grid.v1': {
      const title = readString(props, 'title');
      if (title === null) return null;
      return {
        ...common,
        props: {
          ...common.props,
          title: withLocale(common.props.title, locale, title),
        },
      };
    }

    case 'home.cta.v1': {
      const title = readString(props, 'title');
      const body = readString(props, 'body');
      const actionLabel = readString(props, 'actionLabel');
      if (title === null || body === null || actionLabel === null) return null;
      return {
        ...common,
        props: {
          ...common.props,
          title: withLocale(common.props.title, locale, title),
          body: withLocale(common.props.body, locale, body),
          actionLabel: withLocale(common.props.actionLabel, locale, actionLabel),
        },
      };
    }
  }
}

export function puckDataToBuilderDocument(
  data: Data,
  baseDocument: BuilderDocument,
  locale: string,
  options: PuckAdapterValidationOptions = {},
): PuckAdapterResult {
  const items = readContent(data);
  const issues: string[] = [];

  if (items.length !== baseDocument.sections.length) {
    issues.push('Puck content must preserve the existing section count.');
  }

  const sections: BuilderSection[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const id = readString(item.props, 'id');
    if (!id) {
      issues.push('Every Puck component must retain its JOKO section id.');
      continue;
    }
    if (seen.has(id)) {
      issues.push(`Duplicate Puck section id: ${id}.`);
      continue;
    }
    seen.add(id);

    const section = applyPuckComponentToSection(
      item.type,
      item.props,
      baseDocument,
      locale,
    );

    if (!section) {
      issues.push(`Component ${item.type} (${id}) cannot be mapped to a JOKO section.`);
      continue;
    }
    sections.push(section);
  }

  for (const section of baseDocument.sections) {
    if (!seen.has(section.id)) {
      issues.push(`Missing JOKO section: ${section.id}.`);
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const candidate: BuilderDocument = {
    ...baseDocument,
    sections,
  };

  const validation = validateBuilderDocument(candidate, {
    supportedLocales: options.supportedLocales,
  });

  if (!validation.ok) {
    return {
      ok: false,
      issues: validation.issues.map((issue) => `${issue.path}: ${issue.message}`),
    };
  }

  return { ok: true, document: validation.value };
}
