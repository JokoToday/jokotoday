import type { CharacterSpec } from './creativeLabModel';

export interface KnownCharacterRecord {
  id: string;
  name: string;
  version: number;
  spec: CharacterSpec;
}

const knownCharacters = new Map<string, KnownCharacterRecord>();

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function slugify(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'character';
}

export function registerKnownCharacter(spec: CharacterSpec): KnownCharacterRecord {
  const key = normalizeName(spec.identity.name);
  const existing = knownCharacters.get(key);
  const record: KnownCharacterRecord = {
    id: existing?.id ?? `character-${slugify(spec.identity.name)}-${Date.now()}`,
    name: spec.identity.name.trim(),
    version: (existing?.version ?? 0) + 1,
    spec,
  };

  knownCharacters.set(key, record);
  return record;
}

export function getKnownCharacters(): KnownCharacterRecord[] {
  return Array.from(knownCharacters.values()).sort((a, b) => a.name.localeCompare(b.name));
}
