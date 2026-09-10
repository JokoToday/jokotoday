export type CreativeSection = 'studio' | 'projects' | 'review' | 'library' | 'style';
export type ProjectStatus = 'In progress' | 'Ready for review' | 'Approved';
export type ProjectAccent = 'sage' | 'sand' | 'rose' | 'ink';
export type CreativeProjectType = 'scene' | 'character';

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

export type CharacterStyleStrictness = 'Very strict' | 'Strict' | 'Balanced' | 'Exploratory';

export interface CharacterSpec {
  schemaVersion: 1;
  identity: {
    name: string;
    characterType: string;
    gender?: string;
    ageRange?: string;
    culturalBackground?: string;
  };
  character: {
    profession?: string;
    archetype?: string;
    personality: string[];
    emotionalBaseline?: string;
  };
  visualIdentity: {
    silhouette: string;
    proportionEmphasis?: string;
    signatureIrregularity: string;
    posture?: string;
    face: {
      faceShape?: string;
      eyes?: string;
      nose?: string;
      mouth?: string;
      hair?: string;
      hairTreatment?: string;
      glasses?: string;
      facialHair?: string;
    };
  };
  wardrobe: {
    clothing?: string;
    clothingCharacter?: string;
    patternDetail?: string;
    professionCues: string[];
  };
  props: {
    primary?: string;
    secondary?: string;
  };
  colour: {
    placement?: string;
    accentFamily?: string;
  };
  presentation: {
    outputType: string;
    framing: string;
    viewAngle?: string;
    background: string;
    cardText: string[];
  };
  style: {
    profileId: string;
    profileVersion: 1;
    strictness: CharacterStyleStrictness;
  };
  notes?: string;
}

export interface StyleProfile {
  title: string;
  description: string;
  criteria: string[];
}

export interface ProjectCard {
  id: string;
  projectType: CreativeProjectType;
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
  character?: CharacterSpec;
  createdLabel: string;
}

export interface ProjectDraft {
  scene: SceneAnswers;
  styleProfile: string;
}

export interface CharacterProjectDraft {
  character: CharacterSpec;
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
  assetType: '', purpose: '', subjectType: '', subjectName: '', gender: '', ageRange: '', ethnicBackground: '', profession: '', personality: '', bodySilhouette: '', signatureIrregularity: '', country: '', city: '', place: '', setting: '', action: '', focusObject: '', interaction: '', storyBeat: '', mood: '', energy: '', timeOfDay: '', weather: '', framing: '', viewpoint: '', composition: '',
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

export const characterOptions = {
  characterType: ['Fictional character', 'Stylized real person', OTHER],
  gender: ['Female', 'Male', 'Androgynous / non-binary', NOT_IMPORTANT, OTHER],
  ageRange: ['Child', 'Teenager', 'Young adult', 'Adult', 'Middle-aged', 'Older adult', 'Elderly', NOT_IMPORTANT, OTHER],
  culturalBackground: ['Thai', 'Southeast Asian', 'East Asian', 'South Asian', 'European / White', 'Black / African descent', 'Mixed heritage', NOT_IMPORTANT, OTHER],
  profession: ['Baker', 'Café owner', 'Florist', 'Civil servant', 'Office worker', 'Teacher', 'Student', 'Tech nerd', 'Designer', 'Photographer', 'Market vendor', 'Librarian', 'Gardener', 'Parent', 'Retiree', 'Artist', 'Writer', 'Shopkeeper', 'Observer', NOT_IMPORTANT, OTHER],
  archetype: ['Quiet observer', 'Dutiful worker', 'Curious explorer', 'Dreamer', 'Maker', 'Rule-follower', 'Soft rebel', 'Friendly introvert', 'Thoughtful helper', 'Slightly awkward intellectual', 'Warm professional', 'Practical organizer', NOT_IMPORTANT, OTHER],
  personality: ['Curious', 'Quiet', 'Dutiful', 'Obedient', 'Orderly', 'Rule-following', 'Mildly anxious', 'Thoughtful', 'Dreamy', 'Warm', 'Playful', 'Shy', 'Awkward', 'Mischievous', 'Patient', 'Gentle', 'Skeptical', 'Serious', 'Focused', 'Cheerful', 'Introverted', 'Absent-minded', 'Calm', 'Sensitive', 'Deadpan', OTHER],
  emotionalBaseline: ['Calm', 'Curious', 'Mildly worried', 'Cheerful', 'Thoughtful', 'Neutral / deadpan', 'Sleepy', 'Gentle', 'Reserved', OTHER],
  silhouette: ['Tall & lanky', 'Short & compact', 'Long legs', 'Very long legs', 'Short legs', 'Large head / small body', 'Small head / long body', 'Narrow body', 'Wide-headed', 'Small and upright', 'Slightly hunched', LET_LAB_DECIDE, OTHER],
  proportionEmphasis: ['Head emphasis', 'Eyes emphasis', 'Leg emphasis', 'Arm emphasis', 'Nose emphasis', 'Hair emphasis', 'Balanced exaggeration', LET_LAB_DECIDE, OTHER],
  irregularity: ['Uneven eyes', 'Crooked posture', 'Head tilt', 'Asymmetric hair', 'Long nose', 'Large glasses', 'Uneven stance', 'One foot turned outward', 'Slight shoulder tilt', 'Different-sized eyes', LET_LAB_DECIDE, OTHER],
  posture: ['Upright', 'Leaning forward', 'Slightly hunched', 'Turned inward / shy', 'Relaxed slouch', 'Looking closely', 'Holding something carefully', 'Presenting something', 'Standing neatly', 'Absorbed in task', 'Walking-like stance', LET_LAB_DECIDE, OTHER],
  faceShape: ['Oval', 'Long', 'Round', 'Triangular', 'Pointed chin', 'Wide forehead', 'Narrow face', LET_LAB_DECIDE, OTHER],
  eyes: ['Very large round eyes', 'Large oval eyes', 'Small observant eyes', 'Half-lidded eyes', 'Uneven eyes', 'Side-looking eyes', 'Wide curious eyes', LET_LAB_DECIDE, OTHER],
  nose: ['Tiny nose', 'Small pointed nose', 'Long narrow nose', 'Slightly crooked nose', 'Barely indicated', LET_LAB_DECIDE, OTHER],
  mouth: ['Tiny neutral mouth', 'Small smile', 'Deadpan line', 'Slightly open / curious', 'No visible mouth', LET_LAB_DECIDE, OTHER],
  hair: ['Bob cut', 'Straight fringe / bangs', 'Messy short hair', 'Spiky hair', 'Curly hair', 'Wavy hair', 'Bald / shaved', 'Receding hairline', 'Tied back', 'Neat short hair', 'Long straight hair', LET_LAB_DECIDE, OTHER],
  hairTreatment: ['Solid black', 'Dark with light texture', 'Sparse ink lines', 'Grey / muted tone', NOT_IMPORTANT, LET_LAB_DECIDE, OTHER],
  glasses: ['None', 'Round glasses', 'Square glasses', 'Oversized glasses', 'Small glasses', 'Slightly crooked glasses', OTHER],
  facialHair: ['None', 'Light stubble', 'Short beard', 'Thin moustache', 'Full beard', NOT_IMPORTANT, OTHER],
  clothing: ['Apron', 'Lab coat', 'T-shirt', 'Shirt and tie', 'Sweater', 'Dress', 'Skirt', 'Pants', 'Striped top', 'Work uniform', 'Casual outfit', 'Office outfit', 'Creative outfit', 'Traditional-inspired outfit', NOT_IMPORTANT, OTHER],
  clothingCharacter: ['Neat', 'Slightly messy', 'Practical', 'Formal', 'Casual', 'Quirky', 'Minimal', 'Thoughtful / understated', OTHER],
  patternDetail: ['Plain', 'Stripes', 'Checks', 'Small pocket detail', 'Buttons emphasized', 'Apron pocket', 'Handwritten badge', NOT_IMPORTANT, OTHER],
  primaryProp: ['Flower', 'Magnifying glass', 'Notebook', 'Bread tray', 'Document stack', 'Stamp', 'Mug', 'Circuit board / gadget', 'Camera', 'Book', 'Pen / pencil', 'Basket', 'Plant', 'Laptop', 'Nothing', OTHER],
  secondaryProp: ['Flower', 'Notebook', 'Bread', 'Paper files', 'Office badge', 'Tool', 'Glasses case', 'Plant', 'Device', 'Sign', 'Nothing', OTHER],
  professionCue: ['Apron', 'Name badge', 'Clipboard', 'Pen in pocket', 'Tool in pocket', 'Workbench cue', 'Shelf cue', 'Tray cue', 'Office files', 'Bakery props', 'Tech object', 'Classroom cue', 'Plant / garden cue', 'Nothing', OTHER],
  accentPlacement: ['No accent colour', 'Very small accent colour', 'One accent object only', 'Accent in clothing detail', 'Accent in prop', 'Accent in profession cue', LET_LAB_DECIDE, OTHER],
  accentFamily: ['Yellow / ochre', 'Warm orange', 'Muted red', 'Soft blue', 'Sage green', 'Olive green', NOT_IMPORTANT, LET_LAB_DECIDE, OTHER],
  outputType: ['Character Card', 'Full-Body Character Sheet', 'Profession Portrait', 'Pair Portrait', 'Team / Group Character', 'Character + Props', 'Character Turnaround', OTHER],
  framing: ['Full-body', 'Three-quarter body', 'Half-body', 'Bust / portrait', 'Full-body with side objects', 'Pair portrait', LET_LAB_DECIDE, OTHER],
  viewAngle: ['Front view', 'Slight three-quarter view', 'Side view', 'Looking downward', 'Looking upward', LET_LAB_DECIDE, OTHER],
  background: ['Clean white space', 'Minimal props only', 'Light profession cues', 'Small vignette setting', 'Desk / shelf arrangement', 'Full scene background', LET_LAB_DECIDE, OTHER],
  cardText: ['Character name', 'Personality list', 'Profession label', 'Short description', 'Traits bullets', 'No text', OTHER],
  strictness: ['Very strict', 'Strict', 'Balanced', 'Exploratory'] as CharacterStyleStrictness[],
};

export const initialProjects: ProjectCard[] = [
  {
    id: 'emma-walking-street', projectType: 'scene', title: 'Emma at Sunday Walking Street', subtitle: 'Person · Animated sketch', status: 'In progress', progress: 60, accent: 'sage', assetType: 'Animated sketch', subjectType: 'Person', subjectName: 'Emma', purpose: 'Notebook', styleProfile: 'curious-community-v1', idea: 'Emma, a curious child, walks through Sunday Walking Street in Chiang Mai and notices one unusually beautiful flower. The flower is the only strong accent colour.', scene: { gender: 'Female', ageRange: 'Child', city: 'Chiang Mai', place: 'Sunday Walking Street', action: 'Walking', focusObject: 'Flower', storyBeat: 'Notices something', mood: 'Curious' }, createdLabel: 'Existing concept',
  },
  {
    id: 'almond-croissant-reveal', projectType: 'scene', title: 'Almond Croissant Reveal', subtitle: 'Product · Animated sketch', status: 'In progress', progress: 30, accent: 'sand', assetType: 'Animated sketch', subjectType: 'Product', subjectName: 'Almond Croissant', purpose: 'Product page', styleProfile: 'living-notebook-v1', idea: 'A quiet drawing reveal that makes the croissant feel discovered rather than advertised.', scene: {}, createdLabel: 'Existing concept',
  },
  {
    id: 'croissant-layers-question', projectType: 'scene', title: 'Why do croissants have layers?', subtitle: 'Question · Storyboard', status: 'Ready for review', progress: 85, accent: 'ink', assetType: 'Storyboard', subjectType: 'Question', subjectName: 'Why do croissants have layers?', purpose: 'Question / Answer', styleProfile: 'living-notebook-v1', idea: 'Explain lamination as a calm Notebook sequence, revealing the logic one layer at a time.', scene: {}, createdLabel: 'Existing concept',
  },
  {
    id: 'jokomi-doorway', projectType: 'scene', title: 'Jokomi Bakery Doorway', subtitle: 'Jokomi · Illustration', status: 'Approved', progress: 100, accent: 'sand', assetType: 'Illustration', subjectType: 'Jokomi', subjectName: 'Jokomi', purpose: 'Homepage', styleProfile: 'jokomi-master-v1', idea: 'Jokomi pauses outside the bakery before entering his first home.', scene: {}, createdLabel: 'Existing concept',
  },
];

export function isMeaningful(value: string | undefined) {
  return Boolean(value && value !== NOT_IMPORTANT && value !== LET_LAB_DECIDE && value !== 'Nothing' && value !== 'No text');
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
  const descriptors = scene.subjectType === 'Person' ? [scene.gender, scene.ageRange, scene.ethnicBackground, scene.profession].filter(isMeaningful).join(', ') : '';
  let text = descriptors ? `${subject} (${descriptors})` : subject;
  if (isMeaningful(scene.action)) text += ` is ${scene.action.toLowerCase()}`;
  const where = [scene.place, scene.city, scene.country].filter(isMeaningful);
  if (where.length) text += ` at ${where.join(', ')}`;
  if (isMeaningful(scene.setting)) text += ` in a ${scene.setting.toLowerCase()} setting`;
  text += '.';
  const moment = [scene.storyBeat, isMeaningful(scene.interaction) && isMeaningful(scene.focusObject) ? `${scene.interaction} ${scene.focusObject.toLowerCase()}` : isMeaningful(scene.focusObject) ? `Focus: ${scene.focusObject}` : ''].filter(isMeaningful);
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

export function makeCharacterBrief(spec: CharacterSpec) {
  const identity = [spec.identity.ageRange, spec.identity.gender, spec.identity.culturalBackground].filter(isMeaningful);
  const role = [spec.character.profession, spec.character.archetype].filter(isMeaningful);
  const visual = [spec.visualIdentity.silhouette, spec.visualIdentity.proportionEmphasis, spec.visualIdentity.signatureIrregularity, spec.visualIdentity.posture].filter(isMeaningful);
  const face = Object.values(spec.visualIdentity.face).filter(isMeaningful);
  const wardrobe = [spec.wardrobe.clothing, spec.wardrobe.clothingCharacter, spec.wardrobe.patternDetail].filter(isMeaningful);
  const props = [spec.props.primary, spec.props.secondary].filter(isMeaningful);
  const colour = [spec.colour.placement, spec.colour.accentFamily].filter(isMeaningful);

  let text = `${spec.identity.name} is a ${spec.identity.characterType.toLowerCase()}`;
  if (identity.length) text += ` (${identity.join(', ')})`;
  if (role.length) text += `: ${role.join('; ')}`;
  text += '.';
  if (spec.character.personality.length) text += ` Personality: ${spec.character.personality.join(', ')}.`;
  if (isMeaningful(spec.character.emotionalBaseline)) text += ` Emotional baseline: ${spec.character.emotionalBaseline}.`;
  if (visual.length) text += ` Visual identity: ${visual.join('; ')}.`;
  if (face.length) text += ` Face and head: ${face.join('; ')}.`;
  if (wardrobe.length) text += ` Wardrobe: ${wardrobe.join('; ')}.`;
  if (spec.wardrobe.professionCues.filter(isMeaningful).length) text += ` Profession cues: ${spec.wardrobe.professionCues.filter(isMeaningful).join(', ')}.`;
  if (props.length) text += ` Signature objects: ${props.join('; ')}.`;
  if (colour.length) text += ` Colour: ${colour.join('; ')}.`;
  text += ` Present as ${spec.presentation.outputType}, ${spec.presentation.framing}, with ${spec.presentation.background.toLowerCase()}.`;
  text += ` Style: ${getStyleProfile(spec.style.profileId).title} (${spec.style.strictness.toLowerCase()}).`;
  if (spec.notes?.trim()) text += ` Note: ${spec.notes.trim()}`;
  return text;
}

export function characterSpecTags(spec: CharacterSpec) {
  return [
    spec.identity.characterType,
    spec.identity.gender,
    spec.identity.ageRange,
    spec.identity.culturalBackground,
    spec.character.profession,
    ...spec.character.personality,
    spec.visualIdentity.silhouette,
    spec.visualIdentity.signatureIrregularity,
    spec.visualIdentity.posture,
    spec.props.primary,
    spec.colour.accentFamily,
    spec.presentation.outputType,
  ].filter(isMeaningful).slice(0, 14) as string[];
}
