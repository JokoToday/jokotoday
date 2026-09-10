import type { ProjectDraft, SceneAnswers } from './creativeLabModel';

export type SharedSceneLibraryKind = 'activity' | 'setting';
export type SharedScenePreview = 'sofa' | 'walk' | 'look' | 'market' | 'temple' | 'bakery';

export interface SharedSceneVariant {
  id: string;
  version: number;
  label: string;
  description: string;
  direction: string;
  tags: string[];
  scenePatch: Partial<SceneAnswers>;
  requirements?: string[];
  affordances?: string[];
}

export interface SharedSceneTemplate {
  id: string;
  kind: SharedSceneLibraryKind;
  name: string;
  category: string;
  description: string;
  tags: string[];
  preview: SharedScenePreview;
  defaultVariantId: string;
  variants: SharedSceneVariant[];
}

export interface SceneLibrarySelection {
  kind: SharedSceneLibraryKind;
  templateId: string;
  templateName: string;
  variantId: string;
  version: number;
  variantLabel: string;
  direction: string;
  tags: string[];
}

export interface SceneLibrarySelections {
  activity?: SceneLibrarySelection;
  setting?: SceneLibrarySelection;
}

export interface SceneAssemblyDraft extends ProjectDraft {
  brief: string;
  librarySelections: SceneLibrarySelections;
}

export const activityLibrary: SharedSceneTemplate[] = [
  {
    id: 'activity-sitting-on-sofa',
    kind: 'activity',
    name: 'Sitting on sofa',
    category: 'Seated',
    description: 'Reusable seated body logic with three distinct attitudes.',
    tags: ['sitting', 'seated', 'sofa', 'indoor', 'resting'],
    preview: 'sofa',
    defaultVariantId: 'activity-sitting-on-sofa-v1',
    variants: [
      {
        id: 'activity-sitting-on-sofa-v1',
        version: 1,
        label: 'Upright',
        description: 'Neat, centered sitting posture.',
        direction: 'Sit upright with the torso vertical, feet grounded and the body clearly supported by the sofa.',
        tags: ['upright', 'neat', 'calm'],
        scenePatch: { action: 'Sitting', focusObject: 'Sofa' },
        requirements: ['seat:sofa'],
      },
      {
        id: 'activity-sitting-on-sofa-v2',
        version: 2,
        label: 'Leaning forward',
        description: 'Alert, slightly curious seated pose.',
        direction: 'Sit toward the front of the sofa, leaning slightly forward with attentive body language.',
        tags: ['leaning-forward', 'attentive', 'curious'],
        scenePatch: { action: 'Sitting', focusObject: 'Sofa' },
        requirements: ['seat:sofa'],
      },
      {
        id: 'activity-sitting-on-sofa-v3',
        version: 3,
        label: 'Relaxed side-angle',
        description: 'Looser asymmetric seated posture.',
        direction: 'Sit at a relaxed side angle with an intentionally asymmetric, informal posture while preserving the character silhouette.',
        tags: ['relaxed', 'side-angle', 'asymmetric'],
        scenePatch: { action: 'Sitting', focusObject: 'Sofa' },
        requirements: ['seat:sofa'],
      },
    ],
  },
  {
    id: 'activity-walking',
    kind: 'activity',
    name: 'Walking',
    category: 'Movement',
    description: 'Three reusable walking rhythms for quiet editorial scenes.',
    tags: ['walking', 'movement', 'full-body'],
    preview: 'walk',
    defaultVariantId: 'activity-walking-v1',
    variants: [
      {
        id: 'activity-walking-v1',
        version: 1,
        label: 'Calm front',
        description: 'Slow, composed approach.',
        direction: 'Walk calmly toward the viewer with a small natural stride and restrained body movement.',
        tags: ['calm', 'front-view', 'slow'],
        scenePatch: { action: 'Walking' },
      },
      {
        id: 'activity-walking-v2',
        version: 2,
        label: 'Three-quarter stride',
        description: 'A little more movement and curiosity.',
        direction: 'Walk in a three-quarter direction with one clear stride and a slight turn of attention toward the environment.',
        tags: ['three-quarter', 'curious', 'movement'],
        scenePatch: { action: 'Walking' },
      },
      {
        id: 'activity-walking-v3',
        version: 3,
        label: 'Side profile',
        description: 'Strong silhouette in profile.',
        direction: 'Walk in side profile with the character silhouette reading clearly before interior detail.',
        tags: ['profile', 'silhouette', 'graphic'],
        scenePatch: { action: 'Walking' },
      },
    ],
  },
  {
    id: 'activity-looking-closely',
    kind: 'activity',
    name: 'Looking closely',
    category: 'Observation',
    description: 'Quiet observation poses for discovery-led scenes.',
    tags: ['looking', 'observing', 'curious', 'discovery'],
    preview: 'look',
    defaultVariantId: 'activity-looking-closely-v1',
    variants: [
      {
        id: 'activity-looking-closely-v1',
        version: 1,
        label: 'Gentle lean',
        description: 'Subtle forward curiosity.',
        direction: 'Lean gently toward the subject while keeping the gesture quiet and observational.',
        tags: ['leaning', 'quiet', 'observation'],
        scenePatch: { action: 'Looking', interaction: 'Looks at' },
      },
      {
        id: 'activity-looking-closely-v2',
        version: 2,
        label: 'Crouched inspection',
        description: 'Lower body to inspect a small detail.',
        direction: 'Lower into a compact crouched inspection pose, bringing the face closer to a small object without theatrical expression.',
        tags: ['crouching', 'inspection', 'small-detail'],
        scenePatch: { action: 'Looking', interaction: 'Looks at' },
      },
      {
        id: 'activity-looking-closely-v3',
        version: 3,
        label: 'Magnifier',
        description: 'Object-led close observation.',
        direction: 'Inspect the subject with a magnifying glass, using the prop as a clear identity-neutral activity cue.',
        tags: ['magnifier', 'prop', 'inspection'],
        scenePatch: { action: 'Looking', interaction: 'Looks at', focusObject: 'Magnifying glass' },
        requirements: ['prop:magnifying-glass'],
      },
    ],
  },
];

export const settingLibrary: SharedSceneTemplate[] = [
  {
    id: 'setting-sunday-walking-street',
    kind: 'setting',
    name: 'Sunday Walking Street',
    category: 'Chiang Mai · Market',
    description: 'Reusable interpretations of Chiang Mai Sunday Walking Street.',
    tags: ['Chiang Mai', 'market', 'street', 'outdoor', 'Thailand'],
    preview: 'market',
    defaultVariantId: 'setting-sunday-walking-street-v1',
    variants: [
      {
        id: 'setting-sunday-walking-street-v1',
        version: 1,
        label: 'Wide market street',
        description: 'Open street with stalls on both sides.',
        direction: 'Use a broad Walking Street view with a readable pedestrian lane, simple stall rhythm and enough breathing room around the subject.',
        tags: ['wide', 'street', 'market-stalls'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Sunday Walking Street', setting: 'Street market' },
        affordances: ['walking', 'standing', 'browsing', 'meeting'],
      },
      {
        id: 'setting-sunday-walking-street-v2',
        version: 2,
        label: 'Intimate stall view',
        description: 'Closer scene focused on one stall.',
        direction: 'Move closer to one market stall so products, hands and small discoveries carry the scene while the larger street remains lightly implied.',
        tags: ['close', 'stall', 'intimate'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Sunday Walking Street', setting: 'Street market' },
        affordances: ['looking', 'browsing', 'holding', 'talking'],
      },
      {
        id: 'setting-sunday-walking-street-v3',
        version: 3,
        label: 'Quiet side lane',
        description: 'Calmer edge of the market.',
        direction: 'Use a quieter side-lane interpretation with fewer people, selective hanging details and more negative space.',
        tags: ['quiet', 'side-lane', 'negative-space'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Sunday Walking Street', setting: 'Street market' },
        affordances: ['walking', 'waiting', 'observing'],
      },
    ],
  },
  {
    id: 'setting-doi-suthep-temple',
    kind: 'setting',
    name: 'Doi Suthep Temple',
    category: 'Chiang Mai · Temple',
    description: 'Curated scene structures inspired by Wat Phra That Doi Suthep.',
    tags: ['Chiang Mai', 'temple', 'mountain', 'Thailand', 'heritage'],
    preview: 'temple',
    defaultVariantId: 'setting-doi-suthep-temple-v1',
    variants: [
      {
        id: 'setting-doi-suthep-temple-v1',
        version: 1,
        label: 'Temple terrace',
        description: 'Open terrace with temple silhouette.',
        direction: 'Use an open temple-terrace composition with the architecture readable but simplified and the character given quiet foreground space.',
        tags: ['terrace', 'open', 'architecture'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Doi Suthep Temple', setting: 'Temple terrace' },
        affordances: ['standing', 'walking', 'observing'],
      },
      {
        id: 'setting-doi-suthep-temple-v2',
        version: 2,
        label: 'Naga stair approach',
        description: 'Ascending approach with strong diagonals.',
        direction: 'Use the stair approach as a strong diagonal scene structure, keeping architectural ornament selective rather than over-detailed.',
        tags: ['stairs', 'approach', 'diagonal'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Doi Suthep Temple', setting: 'Temple stairs' },
        affordances: ['walking', 'climbing', 'pausing'],
      },
      {
        id: 'setting-doi-suthep-temple-v3',
        version: 3,
        label: 'Quiet courtyard',
        description: 'Smaller, contemplative temple corner.',
        direction: 'Use a quiet courtyard corner with restrained temple cues, soft negative space and a contemplative editorial feeling.',
        tags: ['courtyard', 'quiet', 'contemplative'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'Doi Suthep Temple', setting: 'Temple courtyard' },
        affordances: ['sitting', 'standing', 'observing'],
      },
    ],
  },
  {
    id: 'setting-joko-today',
    kind: 'setting',
    name: 'JOKO TODAY',
    category: 'JOKO · First home',
    description: 'Reusable scene structures for JOKO TODAY as a place.',
    tags: ['JOKO TODAY', 'bakery', 'Mae Rim', 'Chiang Mai'],
    preview: 'bakery',
    defaultVariantId: 'setting-joko-today-v1',
    variants: [
      {
        id: 'setting-joko-today-v1',
        version: 1,
        label: 'Storefront',
        description: 'Exterior arrival / doorway view.',
        direction: 'Show the JOKO TODAY exterior as a warm, simple arrival scene with the doorway as the main spatial cue.',
        tags: ['exterior', 'doorway', 'arrival'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'JOKO TODAY', setting: 'Bakery' },
        affordances: ['walking', 'entering', 'waiting'],
      },
      {
        id: 'setting-joko-today-v2',
        version: 2,
        label: 'Bakery counter',
        description: 'Interior counter and product interaction.',
        direction: 'Use a compact bakery-counter scene with only the essential product and workspace cues needed to tell the moment.',
        tags: ['interior', 'counter', 'bakery'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'JOKO TODAY', setting: 'Bakery' },
        affordances: ['holding', 'working', 'talking', 'looking'],
      },
      {
        id: 'setting-joko-today-v3',
        version: 3,
        label: 'Garden edge',
        description: 'Quiet outdoor corner around the bakery.',
        direction: 'Use a quiet garden-edge vignette around JOKO TODAY with light plant cues and generous breathing room.',
        tags: ['garden', 'quiet', 'outdoor'],
        scenePatch: { country: 'Thailand', city: 'Chiang Mai', place: 'JOKO TODAY', setting: 'Garden' },
        affordances: ['sitting', 'standing', 'observing', 'meeting'],
      },
    ],
  },
];

export function makeLibrarySelection(template: SharedSceneTemplate, variant: SharedSceneVariant): SceneLibrarySelection {
  return {
    kind: template.kind,
    templateId: template.id,
    templateName: template.name,
    variantId: variant.id,
    version: variant.version,
    variantLabel: variant.label,
    direction: variant.direction,
    tags: [...template.tags, ...variant.tags],
  };
}

export function makeSceneLibraryDirection(selections: SceneLibrarySelections) {
  const parts: string[] = [];
  if (selections.activity) {
    const activity = selections.activity;
    parts.push(`Activity library: ${activity.templateName} v${activity.version} — ${activity.variantLabel}. ${activity.direction}`);
  }
  if (selections.setting) {
    const setting = selections.setting;
    parts.push(`Setting library: ${setting.templateName} v${setting.version} — ${setting.variantLabel}. ${setting.direction}`);
  }
  return parts.join(' ');
}
