import { supabase } from '../../lib/supabase';
import { styleProfiles, type CharacterSpec } from './creativeLabModel';
import {
  savePrototypeLibraryAsset,
  type PrototypeLibraryAsset,
  type PrototypeLibraryAssetRole,
} from './creativeLabLocalLibrary';

export type CharacterReferenceRole =
  | 'character_identity'
  | 'style'
  | 'clothing_appearance'
  | 'pose_posture'
  | 'object_prop'
  | 'supporting';

export type CharacterReferenceFidelity =
  | 'very_close'
  | 'recognizable'
  | 'loose'
  | 'inspiration';

export type CharacterReferencePreserve =
  | 'face'
  | 'hair'
  | 'silhouette'
  | 'clothing'
  | 'expression'
  | 'props'
  | 'overall_feel'
  | 'style';

export interface CharacterProjectReference {
  assetId: string;
  role: CharacterReferenceRole;
  fidelity: CharacterReferenceFidelity;
  preserve: CharacterReferencePreserve[];
  notes?: string;
}

export interface CharacterProductionState {
  schemaVersion: 1;
  references: CharacterProjectReference[];
  candidateAssetIds: string[];
  revisionNote: string;
}

export interface CharacterGenerationRequest {
  schemaVersion: 1;
  projectId: string;
  character: CharacterSpec;
  style: {
    profileId: string;
    title: string;
    description: string;
    criteria: string[];
  };
  references: Array<CharacterProjectReference & {
    assetName: string;
    libraryRole: PrototypeLibraryAssetRole;
    originalFileName: string;
    mimeType: string;
  }>;
  revisionNote?: string;
  candidateCount: 3;
  output: {
    size: '1024x1536';
    quality: 'medium';
  };
}

interface GeneratedCandidatePayload {
  index: number;
  b64Json: string;
  mimeType?: string;
}

interface CharacterGenerationResponse {
  provider: string;
  model: string;
  route?: string;
  requestId?: string;
  costUsd?: number;
  candidates: GeneratedCandidatePayload[];
}

const STATE_PREFIX = 'jt_creative_lab_character_production_v1:';

export const referenceRoleLabels: Record<CharacterReferenceRole, string> = {
  character_identity: 'Character identity',
  style: 'Style / drawing language',
  clothing_appearance: 'Clothing / appearance',
  pose_posture: 'Pose / posture',
  object_prop: 'Object / prop',
  supporting: 'Supporting reference',
};

export const referenceFidelityLabels: Record<CharacterReferenceFidelity, string> = {
  very_close: 'Very close',
  recognizable: 'Recognizable',
  loose: 'Loose',
  inspiration: 'Inspiration',
};

export const referencePreserveLabels: Record<CharacterReferencePreserve, string> = {
  face: 'Face',
  hair: 'Hair',
  silhouette: 'Silhouette',
  clothing: 'Clothing',
  expression: 'Expression',
  props: 'Props',
  overall_feel: 'Overall feel',
  style: 'Style',
};

export const referenceRoles = Object.keys(referenceRoleLabels) as CharacterReferenceRole[];
export const referenceFidelities = Object.keys(referenceFidelityLabels) as CharacterReferenceFidelity[];
export const referencePreserveOptions = Object.keys(referencePreserveLabels) as CharacterReferencePreserve[];

export function defaultReferenceForAsset(asset: PrototypeLibraryAsset): CharacterProjectReference {
  if (asset.role === 'Style reference') {
    return { assetId: asset.id, role: 'style', fidelity: 'inspiration', preserve: ['style', 'overall_feel'] };
  }
  if (asset.role === 'Pose / activity reference') {
    return { assetId: asset.id, role: 'pose_posture', fidelity: 'loose', preserve: ['silhouette'] };
  }
  if (asset.role === 'Object / prop reference') {
    return { assetId: asset.id, role: 'object_prop', fidelity: 'recognizable', preserve: ['props'] };
  }
  if (asset.role === 'Character master') {
    return { assetId: asset.id, role: 'character_identity', fidelity: 'very_close', preserve: ['face', 'hair', 'silhouette', 'overall_feel'] };
  }
  if (asset.role === 'Character identity reference') {
    return { assetId: asset.id, role: 'character_identity', fidelity: 'recognizable', preserve: ['face', 'hair', 'silhouette', 'overall_feel'] };
  }
  return { assetId: asset.id, role: 'supporting', fidelity: 'inspiration', preserve: ['overall_feel'] };
}

export function readCharacterProductionState(projectId: string): CharacterProductionState {
  const fallback: CharacterProductionState = {
    schemaVersion: 1,
    references: [],
    candidateAssetIds: [],
    revisionNote: '',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STATE_PREFIX}${projectId}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as CharacterProductionState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.references) || !Array.isArray(parsed.candidateAssetIds)) return fallback;
    return {
      schemaVersion: 1,
      references: parsed.references.slice(0, 4),
      candidateAssetIds: parsed.candidateAssetIds,
      revisionNote: typeof parsed.revisionNote === 'string' ? parsed.revisionNote : '',
    };
  } catch {
    return fallback;
  }
}

export function writeCharacterProductionState(projectId: string, state: CharacterProductionState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STATE_PREFIX}${projectId}`, JSON.stringify(state));
  } catch {
    // Browser persistence is prototype resilience only; generation must remain usable without it.
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = atob(base64);
  const chunks: Uint8Array[] = [];
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.slice(offset, offset + chunkSize);
    const array = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) array[index] = slice.charCodeAt(index);
    chunks.push(array);
  }
  return new Blob(chunks, { type: mimeType });
}

function makeAssetId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `asset-${crypto.randomUUID()}`;
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function generateCharacterCandidates(input: {
  projectId: string;
  character: CharacterSpec;
  styleProfileId: string;
  references: CharacterProjectReference[];
  assets: PrototypeLibraryAsset[];
  revisionNote: string;
}): Promise<PrototypeLibraryAsset[]> {
  const style = styleProfiles[input.styleProfileId];
  if (!style) throw new Error('The selected Style Profile is unavailable.');

  const referenceAssets = input.references.map((reference) => {
    const asset = input.assets.find((candidate) => candidate.id === reference.assetId);
    if (!asset) throw new Error('One of the selected reference images is no longer in the Library.');
    return { reference, asset };
  });

  const request: CharacterGenerationRequest = {
    schemaVersion: 1,
    projectId: input.projectId,
    character: input.character,
    style: {
      profileId: input.styleProfileId,
      title: style.title,
      description: style.description,
      criteria: style.criteria,
    },
    references: referenceAssets.map(({ reference, asset }) => ({
      ...reference,
      assetName: asset.name,
      libraryRole: asset.role,
      originalFileName: asset.originalFileName,
      mimeType: asset.mimeType,
    })),
    revisionNote: input.revisionNote.trim() || undefined,
    candidateCount: 3,
    output: { size: '1024x1536', quality: 'medium' },
  };

  const formData = new FormData();
  formData.append('request', JSON.stringify(request));
  referenceAssets.forEach(({ asset }) => formData.append('reference', asset.blob, asset.originalFileName));

  const { data, error } = await supabase.functions.invoke('generate-character-candidates', { body: formData });
  if (error) {
    const message = error.message.includes('Failed to send')
      ? 'Character Generation is not activated on the backend yet.'
      : error.message;
    throw new Error(message);
  }

  const payload = data as CharacterGenerationResponse | null;
  if (!payload || !Array.isArray(payload.candidates) || payload.candidates.length === 0) {
    throw new Error('Character Generation returned no candidates.');
  }

  const now = new Date().toISOString();
  const saved: PrototypeLibraryAsset[] = [];
  for (const candidate of payload.candidates) {
    if (!candidate.b64Json) continue;
    const mimeType = candidate.mimeType || 'image/png';
    const blob = base64ToBlob(candidate.b64Json, mimeType);
    const asset: PrototypeLibraryAsset = {
      id: makeAssetId(),
      name: `${input.character.identity.name} · Candidate ${candidate.index + 1}`,
      kind: 'Character',
      subjectName: input.character.identity.name,
      role: 'Character candidate',
      styleProfileId: input.styleProfileId,
      notes: input.revisionNote.trim() || undefined,
      source: 'creative-lab-generation',
      originalFileName: `${input.character.identity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'character'}-candidate-${candidate.index + 1}.png`,
      mimeType,
      fileSize: blob.size,
      createdAt: now,
      blob,
      generation: {
        provider: payload.provider,
        model: payload.model,
        route: payload.route,
        requestId: payload.requestId,
        costUsd: payload.costUsd,
        projectId: input.projectId,
        referenceAssetIds: input.references.map((reference) => reference.assetId),
        status: 'candidate',
      },
    };
    await savePrototypeLibraryAsset(asset);
    saved.push(asset);
  }

  if (saved.length === 0) throw new Error('Character Generation returned unusable candidate data.');
  return saved;
}
