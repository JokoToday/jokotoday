export type CreativeSection = 'studio' | 'projects' | 'review' | 'library' | 'style';
export type ProjectStatus = 'In progress' | 'Ready for review' | 'Approved';
export type ProjectAccent = 'sage' | 'sand' | 'rose' | 'ink';

export type SceneFieldKey =
  | 'assetType'
  | 'purpose'
  | 'subjectType'
  | 'subjectName'
  | 'gender'
  | 'ageRange'
  | 'ethnicBackground'
  | 'profession'
  | 'personality'
  | 'bodySilhouette'
  | 'signatureIrregularity'
  | 'country'
  | 'city'
  | 'place'
  | 'setting'
  | 'action'
  | 'focusObject'
  | 'interaction'
  | 'storyBeat'
  | 'mood'
  | 'energy'
  | 'timeOfDay'
  | 'weather'
  | 'framing'
  | 'viewpoint'
  | 'composition';

export type SceneAnswers = Record<SceneFieldKey, string>;

export interface StyleProfile {
  title: string;
  description: string;
  criteria: string[];
}

export interface ProjectCard {
  id: string;
  title: string;
  subtitle: string;
  status: ProjectStatus;
  progress: number;
  accent: ProjectAccent;
  assetType: string;
  subjectType: string;
  subjectName: string;
  purpose: string;
  styleProfile: string;
  idea: string;
  scene: Partial<SceneAnswers>;
  createdLabel: string;
}

export interface ProjectDraft {
  scene: SceneAnswers;
  styleProfile: string;
}

export const OTHER = 'Other…';
export const NOT_IMPORTANT = 'Not important';
export const LET_LAB_DECIDE = 'Let Creative Lab decide';

export const styleProfiles: Record<string, StyleProfile> = {
  'curious-community-v1': {
    title: 'JOKO Curious Community v1',
    description: 'Quirky Editorial Caricature — affectionate, eccentric, hand-drawn and unmistakably authored.',
    criteria: [
      'Distinctive silhouette before detail',
      'Intentional asymmetry and exaggerated anatomy',
      'Black hand-drawn ink with organic wobble',
      'Sparse hatching and visually light texture',
      '90–95% black / white / off-white with one small accent colour',
      'Warmly deadpan — never generic, cute or glossy',
      'Avoid Pixar, polished 3D, stock-character and corporate-vector styling',
      'Preserve the visual weirdness',
    ],
  },
  'living-notebook-v1': {
    title: 'JOKO Living Notebook v1',
    description: 'Quiet observation, hand-drawn warmth, selective colour and meaningful sketch-to-reality transitions.',
    criteria: [
      'Hand-drawn feel',
      'Soft ink outlines',
      'Selective colour with narrative purpose',
      'Quiet composition with breathing room',
      'Observation before persuasion',
      'Micro storytelling rather than advertising',
    ],
  },
  'jokomi-master-v1': {
    title: 'Jokomi Master v1',
    description: 'Canonical Jokomi proportions, large oval feet, 2D pencil/ink treatment and gentle non-advertising expression.',
    criteria: [
      'Canonical asymmetric grain silhouette',
      'Large oval feet remain a signature feature',
      'Dot eyes, no nose, mouth usually absent',
      '2D pencil / ink treatment, never glossy 3D',
      'Quiet, curious body language',
      'Gentle micro storytelling rather than mascot advertising',
    ],
  },
};

export const emptyScene: SceneAnswers = {
  assetType: '',
  purpose: '',
  subjectType: '',
  subjectName: '',
  gender: '',
  ageRange: '',
  ethnicBackground: '',
  profession: '',
  personality: '',
  bodySilhouette: '',
  signatureIrregularity: '',
  country: '',
  city: '',
  place: '',
  setting: '',
  action: '',
  focusObject: '',
  interaction: '',
  storyBeat: '',
  mood: '',
  energy: '',
  timeOfDay: '',
  weather: '',
  framing: '',
  viewpoint: '',
  composition: '',
};

export const sceneOptions = {
  assetType: ['Illustration', 'Animated sketch', 'Photo treatment', 'Storyboard', 'Short video', 'Audio', 'Mixed media', OTHER],
  purpose: ['Notebook', 'Today', 'Homepage', 'Product page', 'Question / Answer', 'Social', 'Internal only', OTHER],
  subjectType: ['Person', 'Jokomi', 'Product', 'Place', 'Question', 'Object', 'Story', OTHER],
  gender: ['Female', 'Male', 'Androgynous / non-binary', NOT_IMPORTANT, OTHER],
  ageRange: ['Child', 'Teenager', 'Young adult', 'Adult', 'Middle-aged', 'Older adult', 'Elderly', NOT_IMPORTANT, OTHER],
  ethnicBackground: ['Thai', 'Southeast Asian', 'East Asian', 'South Asian', 'European / White', 'Black / African descent', 'Mixed heritage', NOT_IMPORTANT, OTHER],
  profession: ['Baker', 'Civil servant', 'Florist', 'Librarian', 'Programmer', 'Gardener', 'Teacher', 'Retiree', 'Engineer', 'Market vendor', 'Photographer', 'Student', NOT_IMPORTANT, OTHER],
  personality: ['Curious', 'Quiet', 'Dutiful', 'Dreamy', 'Skeptical', 'Energetic', 'Patient', 'Nervous', 'Mischievous', 'Warmly deadpan', OTHER],
  bodySilhouette: ['Tall & lanky', 'Short & compact', 'Very long legs', 'Very short legs', 'Wide-headed', 'Narrow body', 'Large head / small body', 'Small head / long body', LET_LAB_DECIDE, OTHER],
  signatureIrregularity: ['Uneven eyes', 'Crooked posture', 'Asymmetric hair', 'Large glasses', 'Long nose', 'Head tilt', 'Uneven stance', 'One foot turned outward', LET_LAB_DECIDE, OTHER],
  country: ['Thailand', 'Japan', 'France', 'China', 'Germany', NOT_IMPORTANT, OTHER],
  city: ['Chiang Mai', 'Bangkok', 'Tokyo', 'Kyoto', 'Paris', NOT_IMPORTANT, OTHER],
  place: ['JOKO TODAY', 'Sunday Walking Street', 'Mae Rim Bakery', 'Bakery', 'Café', 'Market', 'Garden', 'Home', 'Street', OTHER],
  setting: ['Street market', 'Bakery', 'Café', 'Kitchen', 'Garden', 'Shop', 'Home', 'Nature', 'Studio', OTHER],
  action: ['Walking', 'Sitting', 'Looking', 'Eating', 'Drinking', 'Holding', 'Reading', 'Writing', 'Working', 'Entering', 'Leaving', 'Waiting', 'Laughing', 'Talking', OTHER],
  focusObject: ['Flower', 'Food', 'Book', 'Notebook', 'Shop', 'Sign', 'Animal', 'Person', 'Product', 'Building', NOT_IMPORTANT, OTHER],
  interaction: ['Looks at', 'Picks up', 'Smells', 'Tastes', 'Touches', 'Opens', 'Points at', 'Walks toward', 'Walks past', 'Shares', NOT_IMPORTANT, OTHER],
  storyBeat: ['Notices something', 'Discovers something', 'Meets someone', 'Tries something', 'Gets surprised', 'Gets curious', 'Stops to look', 'Follows something', 'Finds a favourite', 'Learns something', OTHER],
  mood: ['Curious', 'Quiet', 'Happy', 'Awkward', 'Mischievous', 'Surprised', 'Thoughtful', 'Tender', 'Sleepy', 'Excited', 'Puzzled', OTHER],
  energy: ['Very calm', 'Calm', 'Playful', 'Lively', 'Chaotic', NOT_IMPORTANT, OTHER],
  timeOfDay: ['Early morning', 'Morning', 'Noon', 'Afternoon', 'Golden hour', 'Evening', 'Night', NOT_IMPORTANT, OTHER],
  weather: ['Sunny', 'Overcast', 'Light rain', 'Rainy', 'Misty', 'Warm', 'Windy', 'Indoor', NOT_IMPORTANT, OTHER],
  framing: ['Full-body', 'Medium', 'Close-up', 'Wide scene', 'Over-the-shoulder', 'Detail shot', LET_LAB_DECIDE, OTHER],
  viewpoint: ['Eye level', 'Slightly above', 'Slightly below', 'Side view', 'Front view', 'From behind', LET_LAB_DECIDE, OTHER],
  composition: ['Subject centered', 'Subject off-center', 'Lots of empty space', 'Environment dominant', 'Object dominant', LET_LAB_DECIDE, OTHER],
};

export const initialProjects: ProjectCard[] = [
  {
    id: 'emma-walking-street',
    title: 'Emma at Sunday Walking Street',
    subtitle: 'Person · Animated sketch',
    status: 'In progress',
    progress: 60,
    accent: 'sage',
    assetType: 'Animated sketch',
    subjectType: 'Person',
    subjectName: 'Emma',
    purpose: 'Notebook',
    styleProfile: 'curious-community-v1',
    idea: 'Emma, a curious child, walks through Sunday Walking Street in Chiang Mai and notices one unusually beautiful flower. The flower is the only strong accent colour.',
    scene: { gender: 'Female', ageRange: 'Child', city: 'Chiang Mai', place: 'Sunday Walking Street', action: 'Walking', focusObject: 'Flower', storyBeat: 'Notices something', mood: 'Curious' },
    createdLabel: 'Existing concept',
  },
  {
    id: 'almond-croissant-reveal', title: 'Almond Croissant Reveal', subtitle: 'Product · Animated sketch', status: 'In progress', progress: 30, accent: 'sand', assetType: 'Animated sketch', subjectType: 'Product', subjectName: 'Almond Croissant', purpose: 'Product page', styleProfile: 'living-notebook-v1', idea: 'A quiet drawing reveal that makes the croissant feel discovered rather than advertised.', scene: {}, createdLabel: 'Existing concept',
  },
  {
    id: 'croissant-layers-question', title: 'Why do croissants have layers?', subtitle: 'Question · Storyboard', status: 'Ready for review', progress: 85, accent: 'ink', assetType: 'Storyboard', subjectType: 'Question', subjectName: 'Why do croissants have layers?', purpose: 'Question / Answer', styleProfile: 'living-notebook-v1', idea: 'Explain lamination as a calm Notebook sequence, revealing the logic one layer at a time.', scene: {}, createdLabel: 'Existing concept',
  },
  {
    id: 'jokomi-doorway', title: 'Jokomi Bakery Doorway', subtitle: 'Jokomi · Illustration', status: 'Approved', progress: 100, accent: 'sand', assetType: 'Illustration', subjectType: 'Jokomi', subjectName: 'Jokomi', purpose: 'Homepage', styleProfile: 'jokomi-master-v1', idea: 'Jokomi pauses outside the bakery before entering his first home.', scene: {}, createdLabel: 'Existing concept',
  },
];

export function isMeaningful(value: string | undefined) {
  return Boolean(value && value !== NOT_IMPORTANT && value !== LET_LAB_DECIDE);
}

export function getStyleProfile(id: string): StyleProfile {
  return styleProfiles[id] ?? {
    title: id || 'Custom style',
    description: 'Custom visual language supplied for this project.',
    criteria: ['Follow the supplied visual reference consistently', 'Keep the result authored and intentional', 'Human style review required before approval'],
  };
}

export function recommendedStyleFor(subjectType: string) {
  if (subjectType === 'Jokomi') return 'jokomi-master-v1';
  if (subjectType === 'Person') return 'curious-community-v1';
  return 'living-notebook-v1';
}

export function subjectOptionsFor(subjectType: string) {
  switch (subjectType) {
    case 'Person': return ['Emma', 'Theo', 'Jo', 'Phuttan', 'Tech Nerd', 'Elderly Thai Lady', 'Introverted Librarian', OTHER];
    case 'Jokomi': return ['Jokomi', OTHER];
    case 'Product': return ['Almond Croissant', 'Strawberry Cake', 'Croissant', 'Bread', 'Cake', OTHER];
    case 'Place': return ['JOKO TODAY', 'Sunday Walking Street', 'Mae Rim Bakery', OTHER];
    case 'Question': return ['Why do croissants have layers?', 'What makes bread chewy?', 'Why does butter matter?', OTHER];
    case 'Object': return ['Flower', 'Notebook', 'Bread tray', 'Camera', 'Umbrella', OTHER];
    case 'Story': return ['Small discovery', 'A softer morning', 'Unexpected meeting', OTHER];
    default: return [OTHER];
  }
}

export function makeSceneBrief(scene: SceneAnswers) {
  const subject = scene.subjectName || scene.subjectType || 'The subject';
  const descriptors = scene.subjectType === 'Person'
    ? [scene.gender, scene.ageRange, scene.ethnicBackground, scene.profession].filter(isMeaningful).join(', ')
    : '';
  let text = descriptors ? `${subject} (${descriptors})` : subject;
  if (isMeaningful(scene.action)) text += ` is ${scene.action.toLowerCase()}`;
  const where = [scene.place, scene.city, scene.country].filter(isMeaningful);
  if (where.length) text += ` at ${where.join(', ')}`;
  if (isMeaningful(scene.setting)) text += ` in a ${scene.setting.toLowerCase()} setting`;
  text += '.';

  const moment = [
    scene.storyBeat,
    isMeaningful(scene.interaction) && isMeaningful(scene.focusObject)
      ? `${scene.interaction} ${scene.focusObject.toLowerCase()}`
      : isMeaningful(scene.focusObject) ? `Focus: ${scene.focusObject}` : '',
  ].filter(isMeaningful);
  if (moment.length) text += ` ${moment.join('; ')}.`;

  const character = [scene.personality, scene.bodySilhouette, scene.signatureIrregularity].filter(isMeaningful);
  if (character.length) text += ` Character direction: ${character.join('; ')}.`;
  const atmosphere = [scene.mood, scene.energy, scene.timeOfDay, scene.weather].filter(isMeaningful);
  if (atmosphere.length) text += ` Atmosphere: ${atmosphere.join('; ')}.`;
  const camera = [scene.framing, scene.viewpoint, scene.composition].filter(isMeaningful);
  if (camera.length) text += ` Composition: ${camera.join('; ')}.`;
  return text;
}

export function makeProjectTitle(scene: SceneAnswers) {
  const subject = scene.subjectName || scene.subjectType || 'Untitled';
  if (isMeaningful(scene.place)) return `${subject} at ${scene.place}`;
  if (isMeaningful(scene.action)) return `${subject} · ${scene.action}`;
  return subject;
}
