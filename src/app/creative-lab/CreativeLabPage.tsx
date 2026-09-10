import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Folder,
  Image,
  LayoutGrid,
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreativeLabPageProps {
  onNavigate: (page: string) => void;
}

type CreativeSection = 'studio' | 'projects' | 'review' | 'library' | 'style';
type ProjectStatus = 'In progress' | 'Ready for review' | 'Approved';
type ProjectAccent = 'sage' | 'sand' | 'rose' | 'ink';
type StyleProfileId = 'living-notebook-v1' | 'jokomi-master-v1';

type AssetType =
  | 'Illustration'
  | 'Animated sketch'
  | 'Photo'
  | 'Video'
  | 'Audio'
  | 'Storyboard'
  | 'Mixed media';

type SubjectType = 'Person' | 'Product' | 'Question' | 'Place' | 'Story' | 'Jokomi';
type Purpose = 'Notebook' | 'Today' | 'Homepage' | 'Product editorial' | 'Question / Answer' | 'Social' | 'Other';

interface ProjectCard {
  id: string;
  title: string;
  subtitle: string;
  status: ProjectStatus;
  progress: number;
  accent: ProjectAccent;
  assetType: AssetType;
  subjectType: SubjectType;
  subjectName: string;
  purpose: Purpose;
  styleProfile: StyleProfileId;
  idea: string;
  createdLabel: string;
}

interface ProjectDraft {
  title: string;
  assetType: AssetType | '';
  subjectType: SubjectType | '';
  subjectName: string;
  purpose: Purpose | '';
  styleProfile: StyleProfileId | '';
  idea: string;
}

const styleProfiles: Record<StyleProfileId, { title: string; description: string; criteria: string[] }> = {
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

const initialProjects: ProjectCard[] = [
  {
    id: 'emma-walking-street',
    title: 'Emma at Sunday Walking Street',
    subtitle: 'Person · Place · Micro story',
    status: 'In progress',
    progress: 60,
    accent: 'sage',
    assetType: 'Animated sketch',
    subjectType: 'Person',
    subjectName: 'Emma',
    purpose: 'Notebook',
    styleProfile: 'living-notebook-v1',
    idea: 'Emma notices one unusually beautiful flower while walking through Sunday Walking Street. Quiet, observant and gently curious.',
    createdLabel: 'Existing concept',
  },
  {
    id: 'almond-croissant-reveal',
    title: 'Almond Croissant Reveal',
    subtitle: 'Product · Animated sketch',
    status: 'In progress',
    progress: 30,
    accent: 'sand',
    assetType: 'Animated sketch',
    subjectType: 'Product',
    subjectName: 'Almond Croissant',
    purpose: 'Product editorial',
    styleProfile: 'living-notebook-v1',
    idea: 'A quiet drawing reveal that shows the croissant as a small discovery rather than a product advertisement.',
    createdLabel: 'Existing concept',
  },
  {
    id: 'croissant-layers-question',
    title: 'Why do croissants have layers?',
    subtitle: 'Question · Explainer',
    status: 'Ready for review',
    progress: 85,
    accent: 'ink',
    assetType: 'Storyboard',
    subjectType: 'Question',
    subjectName: 'Why do croissants have layers?',
    purpose: 'Question / Answer',
    styleProfile: 'living-notebook-v1',
    idea: 'Explain lamination as a calm Notebook sequence, using drawing to reveal the logic one layer at a time.',
    createdLabel: 'Existing concept',
  },
  {
    id: 'strawberry-cake',
    title: 'New Strawberry Cake',
    subtitle: 'Product · Today candidate',
    status: 'Ready for review',
    progress: 90,
    accent: 'rose',
    assetType: 'Illustration',
    subjectType: 'Product',
    subjectName: 'Strawberry Cake',
    purpose: 'Today',
    styleProfile: 'living-notebook-v1',
    idea: 'A restrained illustration for Today with the strawberry colour as the single visual highlight.',
    createdLabel: 'Existing concept',
  },
  {
    id: 'jokomi-doorway',
    title: 'Jokomi Bakery Doorway',
    subtitle: 'Jokomi · Homepage scene',
    status: 'Approved',
    progress: 100,
    accent: 'sage',
    assetType: 'Illustration',
    subjectType: 'Jokomi',
    subjectName: 'Jokomi',
    purpose: 'Homepage',
    styleProfile: 'jokomi-master-v1',
    idea: 'Jokomi pauses outside the bakery before entering his first home.',
    createdLabel: 'Existing concept',
  },
  {
    id: 'softer-morning',
    title: 'A Softer Morning',
    subtitle: 'Story · Notebook image',
    status: 'Approved',
    progress: 100,
    accent: 'sand',
    assetType: 'Illustration',
    subjectType: 'Story',
    subjectName: 'A Softer Morning',
    purpose: 'Notebook',
    styleProfile: 'living-notebook-v1',
    idea: 'A small morning observation with generous negative space and only one important detail in colour.',
    createdLabel: 'Existing concept',
  },
];

const navItems: Array<{ id: CreativeSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'studio', label: 'Studio', icon: LayoutGrid },
  { id: 'projects', label: 'Projects', icon: Folder },
  { id: 'review', label: 'Review', icon: MessageSquare },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'style', label: 'Style', icon: Palette },
];

const assetTypes: AssetType[] = ['Illustration', 'Animated sketch', 'Photo', 'Video', 'Audio', 'Storyboard', 'Mixed media'];
const subjectTypes: SubjectType[] = ['Person', 'Product', 'Question', 'Place', 'Story', 'Jokomi'];
const purposes: Purpose[] = ['Notebook', 'Today', 'Homepage', 'Product editorial', 'Question / Answer', 'Social', 'Other'];
const projectSteps = ['Idea', 'Brief', 'Create', 'Review', 'Approved'];

function accentClass(accent: ProjectAccent) {
  switch (accent) {
    case 'sage':
      return 'from-emerald-50 via-stone-50 to-amber-50';
    case 'sand':
      return 'from-amber-50 via-orange-50 to-stone-100';
    case 'rose':
      return 'from-rose-50 via-orange-50 to-amber-50';
    default:
      return 'from-slate-50 via-stone-50 to-zinc-100';
  }
}

function sectionHeading(section: CreativeSection) {
  switch (section) {
    case 'projects':
      return ['Projects', 'Everything currently moving from idea to approval.'] as const;
    case 'review':
      return ['Review', 'Decide what is good enough to become part of the JOKO world.'] as const;
    case 'library':
      return ['Library', 'The visual memory of approved and in-progress creative work.'] as const;
    case 'style':
      return ['Style', 'The visual language is production infrastructure — and one of our moats.'] as const;
    default:
      return ['What are we making today?', 'Turn an idea into a brief, source material, outputs, review and an approved JOKO asset.'] as const;
  }
}

export default function CreativeLabPage({ onNavigate }: CreativeLabPageProps) {
  const { user, userRole, loading, profileLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<CreativeSection>('studio');
  const [projectList, setProjectList] = useState<ProjectCard[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [wizardOpen, setWizardOpen] = useState(false);

  const selectedProject = projectList.find((project) => project.id === selectedProjectId) ?? projectList[0];
  const [heading, subheading] = sectionHeading(activeSection);

  const openProject = (project: ProjectCard, destination: CreativeSection = 'studio') => {
    setSelectedProjectId(project.id);
    setActiveSection(destination);
  };

  const createProject = (draft: ProjectDraft) => {
    const fallbackTitle = draft.subjectName.trim() || draft.assetType || 'Untitled creative project';
    const newProject: ProjectCard = {
      id: `creative-${Date.now()}`,
      title: draft.title.trim() || fallbackTitle,
      subtitle: `${draft.subjectType || 'Story'} · ${draft.assetType || 'Illustration'}`,
      status: 'In progress',
      progress: 10,
      accent: draft.styleProfile === 'jokomi-master-v1' ? 'sand' : 'sage',
      assetType: draft.assetType || 'Illustration',
      subjectType: draft.subjectType || 'Story',
      subjectName: draft.subjectName.trim() || fallbackTitle,
      purpose: draft.purpose || 'Notebook',
      styleProfile: draft.styleProfile || 'living-notebook-v1',
      idea: draft.idea.trim(),
      createdLabel: 'Created in this prototype session',
    };

    setProjectList((current) => [newProject, ...current]);
    setSelectedProjectId(newProject.id);
    setActiveSection('studio');
    setWizardOpen(false);
  };

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center px-6">
        <div className="flex items-center gap-3 text-stone-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Opening Creative Lab…</span>
        </div>
      </div>
    );
  }

  if (!user || userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
            {user ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">JOKO Creative Lab</p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {user ? 'Admin access required' : 'Sign in to enter the studio'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Creative Lab uses the existing JOKO TODAY admin identity. Sign in through Admin, then return here to create and review media.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            Open Admin sign in
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-stone-200 bg-stone-50 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-5 lg:block lg:px-6 lg:py-8">
            <div>
              <p className="font-serif text-2xl leading-none text-stone-950">JOKO</p>
              <p className="mt-1 font-serif text-lg text-stone-700">Creative Lab</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="rounded-lg px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:bg-white hover:text-stone-800 lg:mt-5 lg:w-full lg:text-left"
            >
              Back to Admin
            </button>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`inline-flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors lg:w-full ${
                    selected ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-600 hover:bg-white hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden px-6 py-8 lg:block">
            <div className="border-t border-stone-200 pt-6">
              <p className="font-serif text-lg italic leading-7 text-stone-500">“Make it feel unmistakably JOKO.”</p>
              <p className="mt-3 text-xs leading-5 text-stone-400">The studio is operational. The style is the moat.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-stone-200 bg-white px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{activeSection}</p>
                <h1 className="font-serif text-3xl text-stone-950 sm:text-4xl">{heading}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subheading}</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" />
                Create something
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
            <PrototypeNotice />
            {activeSection === 'studio' && (
              <StudioView projects={projectList} selectedProject={selectedProject} onOpenProject={openProject} />
            )}
            {activeSection === 'projects' && <ProjectsView projects={projectList} onOpenProject={openProject} />}
            {activeSection === 'review' && (
              <ReviewView projects={projectList} selectedProject={selectedProject} onOpenProject={openProject} />
            )}
            {activeSection === 'library' && <LibraryView projects={projectList} onOpenProject={openProject} />}
            {activeSection === 'style' && <StyleView selectedProject={selectedProject} />}
          </div>
        </main>
      </div>

      {wizardOpen && <CreateProjectWizard onClose={() => setWizardOpen(false)} onCreate={createProject} />}
    </div>
  );
}

function PrototypeNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
      <span><strong>Prototype mode:</strong> projects created here live only in this browser session. Persistence comes after we approve the workflow.</span>
      <span className="font-semibold">No Supabase writes yet</span>
    </div>
  );
}

function StudioView({
  projects,
  selectedProject,
  onOpenProject,
}: {
  projects: ProjectCard[];
  selectedProject: ProjectCard;
  onOpenProject: (project: ProjectCard, destination?: CreativeSection) => void;
}) {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-3">
        <ProjectLane title="In progress" projects={projects.filter((project) => project.status === 'In progress')} onOpenProject={onOpenProject} />
        <ProjectLane title="Ready for review" projects={projects.filter((project) => project.status === 'Ready for review')} onOpenProject={onOpenProject} />
        <ProjectLane title="Recently approved" projects={projects.filter((project) => project.status === 'Approved')} onOpenProject={onOpenProject} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <ProjectWorkspace project={selectedProject} />
        <StyleGuardian project={selectedProject} />
      </section>
    </>
  );
}

function ProjectWorkspace({ project }: { project: ProjectCard }) {
  const currentStep = project.status === 'Approved' ? 4 : project.status === 'Ready for review' ? 3 : Math.max(0, Math.min(2, Math.floor(project.progress / 25)));

  return (
    <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Selected project</p>
            <h2 className="mt-1 font-serif text-2xl text-stone-950">{project.title}</h2>
            <p className="mt-1 text-sm text-stone-500">{project.subjectName} · {project.purpose} · {project.createdLabel}</p>
          </div>
          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{project.status}</span>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-2">
          {projectSteps.map((step, index) => {
            const complete = index < currentStep || project.status === 'Approved';
            const active = index === currentStep && project.status !== 'Approved';
            return (
              <div key={step} className="min-w-0 text-center">
                <div className="flex items-center">
                  <span className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : complete || active ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    complete
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : active
                      ? 'border-emerald-600 bg-white text-emerald-700'
                      : 'border-stone-300 bg-white text-stone-300'
                  }`}>
                    {complete ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5" fill="currentColor" />}
                  </span>
                  <span className={`h-px flex-1 ${index === projectSteps.length - 1 ? 'bg-transparent' : complete ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                </div>
                <p className={`mt-2 truncate text-[11px] font-medium ${complete || active ? 'text-stone-700' : 'text-stone-400'}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-2 2xl:grid-cols-4">
        <WorkspaceCard icon={FileText} title="Creative Brief">
          <p className="text-sm leading-6 text-stone-600">{project.idea || 'The idea is captured. The detailed creative brief will be developed here.'}</p>
          <div className="mt-4 space-y-2 text-xs text-stone-500">
            <p>{styleProfiles[project.styleProfile].title}</p>
            <p>{project.assetType} · intended for {project.purpose}</p>
          </div>
        </WorkspaceCard>

        <WorkspaceCard icon={Image} title="Source Material">
          <div className="grid grid-cols-2 gap-2">
            {['Reference', 'Master subject', 'Visual note', 'Research'].map((label) => (
              <div key={label} className="aspect-[4/3] rounded-xl border border-stone-200 bg-gradient-to-br from-stone-100 to-amber-50 p-3">
                <p className="text-[11px] font-medium text-stone-500">{label}</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 text-xs font-semibold text-stone-700">+ Add material</button>
        </WorkspaceCard>

        <WorkspaceCard icon={PlayCircle} title="Outputs">
          <div className="space-y-2">
            {project.progress >= 30 ? <OutputRow type={project.assetType} name={`${project.id}-master`} /> : <EmptyOutput />}
            {project.progress >= 70 && <OutputRow type="Poster" name={`${project.id}-poster`} />}
          </div>
          <button type="button" className="mt-4 text-xs font-semibold text-stone-700">+ Create new output</button>
        </WorkspaceCard>

        <WorkspaceCard icon={MessageSquare} title="Review">
          {project.status === 'Approved' ? (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Approved for reuse. Publication remains a separate decision.</div>
          ) : (
            <div className="space-y-3">
              <Comment initials="J" text="Review the idea against its governing Style Profile before approval." />
              <Comment initials="S" text={`Current style: ${styleProfiles[project.styleProfile].title}.`} />
            </div>
          )}
          <button type="button" className="mt-4 text-xs font-semibold text-stone-700">Open review</button>
        </WorkspaceCard>
      </div>
    </div>
  );
}

function ProjectLane({
  title,
  projects,
  onOpenProject,
}: {
  title: string;
  projects: ProjectCard[];
  onOpenProject: (project: ProjectCard, destination?: CreativeSection) => void;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">{projects.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProject(project)}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition-shadow hover:shadow-md"
          >
            <div className={`aspect-[16/8] bg-gradient-to-br ${accentClass(project.accent)} p-3`}>
              <div className="flex h-full items-end justify-between gap-2">
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-500">{project.subjectType}</span>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-500">{project.assetType}</span>
              </div>
            </div>
            <div className="p-3">
              <p className="min-h-10 text-sm font-semibold leading-5 text-stone-800">{project.title}</p>
              <p className="mt-1 text-[11px] text-stone-400">{styleProfiles[project.styleProfile].title}</p>
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${project.progress}%` }} />
                </div>
                <p className="mt-1 text-right text-[10px] font-medium text-stone-400">{project.progress}%</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkspaceCard({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-stone-500" />
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function OutputRow({ type, name }: { type: string; name: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{type}</p>
          <p className="mt-1 truncate text-xs font-medium text-stone-700">{name}</p>
        </div>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      </div>
    </div>
  );
}

function EmptyOutput() {
  return <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-xs leading-5 text-stone-500">No output yet. The project is ready for its first creative file.</div>;
}

function Comment({ initials, text }: { initials: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-stone-50 p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white">{initials}</div>
      <p className="text-xs leading-5 text-stone-600">{text}</p>
    </div>
  );
}

function StyleGuardian({ project }: { project: ProjectCard }) {
  const profile = styleProfiles[project.styleProfile];

  return (
    <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-stone-600" />
        <h2 className="font-serif text-xl text-stone-900">Style Guardian</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-500">The visual constitution beside every project.</p>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 via-amber-50 to-emerald-50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Governing profile</p>
        <p className="mt-2 text-sm font-semibold text-stone-800">{profile.title}</p>
        <p className="mt-2 text-[11px] leading-5 text-stone-600">{profile.description}</p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Style criteria</p>
        <div className="mt-3 space-y-2.5">
          {profile.criteria.map((criterion) => (
            <div key={criterion} className="flex items-start gap-2 text-xs leading-5 text-stone-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Check className="h-3 w-3" />
              </span>
              {criterion}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-stone-200 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Approval flow</p>
        <div className="mt-4 grid grid-cols-4 gap-1 text-center">
          {['Technical QA', 'Style Check', 'Editorial', 'Human'].map((step) => (
            <div key={step}>
              <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3 w-3" />
              </div>
              <p className="mt-2 text-[9px] font-medium leading-3 text-stone-500">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-emerald-800">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-sm font-semibold">Style profile attached</p>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-emerald-700">Final Style: Pass remains a human review decision.</p>
      </div>
    </aside>
  );
}

function ProjectsView({
  projects,
  onOpenProject,
}: {
  projects: ProjectCard[];
  onOpenProject: (project: ProjectCard, destination?: CreativeSection) => void;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">Projects</h2>
          <p className="mt-1 text-sm text-stone-500">Creative work currently moving from idea to approval.</p>
        </div>
        <Folder className="h-5 w-5 text-stone-400" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProject(project)}
            className="rounded-2xl border border-stone-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className={`mb-4 aspect-[16/7] rounded-xl bg-gradient-to-br ${accentClass(project.accent)}`} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-800">{project.title}</p>
                <p className="mt-1 text-xs text-stone-500">{project.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
            </div>
            <p className="mt-3 text-[11px] text-stone-500">{styleProfiles[project.styleProfile].title}</p>
            <span className="mt-4 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">{project.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReviewView({
  projects,
  selectedProject,
  onOpenProject,
}: {
  projects: ProjectCard[];
  selectedProject: ProjectCard;
  onOpenProject: (project: ProjectCard, destination?: CreativeSection) => void;
}) {
  const reviewProjects = projects.filter((project) => project.status === 'Ready for review');
  const projectForReview = selectedProject.status === 'Ready for review' ? selectedProject : reviewProjects[0] ?? selectedProject;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Review queue</p>
          <h2 className="mt-2 font-serif text-2xl text-stone-900">{reviewProjects.length} {reviewProjects.length === 1 ? 'piece needs' : 'pieces need'} a decision</h2>
          <div className="mt-6 space-y-3">
            {reviewProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpenProject(project, 'review')}
                className={`flex w-full flex-col gap-4 rounded-2xl border p-4 text-left sm:flex-row sm:items-center sm:justify-between ${
                  projectForReview.id === project.id ? 'border-stone-400 bg-stone-50' : 'border-stone-200 bg-white'
                }`}
              >
                <div>
                  <p className="font-semibold text-stone-800">{project.title}</p>
                  <p className="mt-1 text-xs text-stone-500">{project.subtitle} · {styleProfiles[project.styleProfile].title}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700">
                  Review
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Current review</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-900">{projectForReview.title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{projectForReview.idea}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {['Technical QA', 'Style Check', 'Editorial Review'].map((label, index) => (
              <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center gap-2">
                  {index === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-stone-400" />}
                  <p className="text-xs font-semibold text-stone-700">{label}</p>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-stone-500">{index === 0 ? 'Prototype check complete.' : 'Human decision required.'}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700">Request changes</button>
            <button type="button" className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white">Approve for Notebook</button>
          </div>
        </div>
      </div>

      <StyleGuardian project={projectForReview} />
    </section>
  );
}

function LibraryView({
  projects,
  onOpenProject,
}: {
  projects: ProjectCard[];
  onOpenProject: (project: ProjectCard, destination?: CreativeSection) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = useMemo(
    () => projects.filter((project) => {
      if (!normalizedQuery) return true;
      return [project.title, project.subtitle, project.subjectName, project.assetType, project.purpose, styleProfiles[project.styleProfile].title]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    }),
    [normalizedQuery, projects],
  );

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">Media Library</h2>
          <p className="mt-1 text-sm text-stone-500">Browse by subject, output type, purpose or governing style.</p>
        </div>
        <label className="relative block w-full md:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the visual memory…"
            className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-800 outline-none focus:border-stone-500"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {filteredProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onOpenProject(project)}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition-shadow hover:shadow-md"
          >
            <div className={`aspect-square bg-gradient-to-br ${accentClass(project.accent)} p-4`}>
              <div className="flex h-full items-center justify-center rounded-2xl border border-white bg-white">
                <Image className="h-7 w-7 text-stone-400" />
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-stone-800">{project.title}</p>
              <p className="mt-1 text-[11px] text-stone-500">{project.subtitle}</p>
              <p className="mt-2 text-[10px] font-medium text-stone-400">{styleProfiles[project.styleProfile].title}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function StyleView({ selectedProject }: { selectedProject: ProjectCard }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">JOKO visual moat</p>
            <h2 className="mt-1 font-serif text-3xl text-stone-900">Style is production infrastructure.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              Every creative project inherits a versioned visual language before creation begins. Approved examples, anti-examples, character rules and review criteria stay close to the work itself.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {(Object.entries(styleProfiles) as Array<[StyleProfileId, (typeof styleProfiles)[StyleProfileId]]>).map(([id, profile]) => (
            <StyleProfile key={id} id={id} title={profile.title} description={profile.description} />
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <p className="text-sm font-semibold text-stone-800">Golden references</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Approved and rejected examples will become a reusable JOKO visual-quality dataset — including why an output passed or failed.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ReferenceCard label="YES · Canonical" />
            <ReferenceCard label="YES · Canonical" />
            <ReferenceCard label="NO · Too polished / 3D" muted />
          </div>
        </div>
      </div>

      <StyleGuardian project={selectedProject} />
    </section>
  );
}

function StyleProfile({ id, title, description }: { id: StyleProfileId; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex aspect-[16/8] items-end rounded-xl bg-gradient-to-br from-stone-100 via-amber-50 to-emerald-50 p-4">
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-stone-500">{id}</span>
      </div>
      <p className="font-semibold text-stone-800">{title}</p>
      <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
      <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700">
        Open profile
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ReferenceCard({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${muted ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className={`aspect-[4/3] rounded-lg ${muted ? 'bg-rose-100' : 'bg-emerald-100'}`} />
      <p className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${muted ? 'text-rose-700' : 'text-emerald-700'}`}>{label}</p>
    </div>
  );
}

function CreateProjectWizard({ onClose, onCreate }: { onClose: () => void; onCreate: (draft: ProjectDraft) => void }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>({
    title: '',
    assetType: '',
    subjectType: '',
    subjectName: '',
    purpose: '',
    styleProfile: '',
    idea: '',
  });

  const canContinue = (() => {
    if (step === 0) return Boolean(draft.assetType);
    if (step === 1) return Boolean(draft.subjectType && draft.subjectName.trim());
    if (step === 2) return Boolean(draft.purpose);
    if (step === 3) return Boolean(draft.styleProfile);
    return Boolean(draft.idea.trim());
  })();

  const next = () => {
    if (!canContinue) return;
    setStep((current) => Math.min(4, current + 1));
  };

  const previous = () => setStep((current) => Math.max(0, current - 1));

  const recommendedStyle = draft.subjectType === 'Jokomi' ? 'jokomi-master-v1' : 'living-notebook-v1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create a Creative Lab project">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Create something</p>
            <p className="mt-1 text-sm font-semibold text-stone-800">Step {step + 1} of 5</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Close create project">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-8">
          <WizardProgress step={step} />

          {step === 0 && (
            <WizardStep title="What are we making?" note="Choose the primary output. We can add derivatives later.">
              <OptionGrid
                options={assetTypes}
                selected={draft.assetType}
                onSelect={(assetType) => setDraft((current) => ({ ...current, assetType }))}
              />
            </WizardStep>
          )}

          {step === 1 && (
            <WizardStep title="Who or what is this about?" note="Media should belong to a canonical subject — not to Today itself.">
              <OptionGrid
                options={subjectTypes}
                selected={draft.subjectType}
                onSelect={(subjectType) => setDraft((current) => ({ ...current, subjectType }))}
              />
              <label className="mt-6 block">
                <span className="text-xs font-semibold text-stone-700">Subject name</span>
                <input
                  value={draft.subjectName}
                  onChange={(event) => setDraft((current) => ({ ...current, subjectName: event.target.value }))}
                  placeholder="Emma, Almond Croissant, Sunday Walking Street…"
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-stone-500"
                />
              </label>
            </WizardStep>
          )}

          {step === 2 && (
            <WizardStep title="What is it for?" note="Purpose helps us create the right outputs. It does not make the publishing surface the owner of the media.">
              <OptionGrid
                options={purposes}
                selected={draft.purpose}
                onSelect={(purpose) => setDraft((current) => ({ ...current, purpose }))}
              />
            </WizardStep>
          )}

          {step === 3 && (
            <WizardStep title="Which visual language governs this project?" note="Style is mandatory before creation begins. This is part of JOKO’s production moat.">
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.entries(styleProfiles) as Array<[StyleProfileId, (typeof styleProfiles)[StyleProfileId]]>).map(([id, profile]) => {
                  const selected = draft.styleProfile === id;
                  const recommended = id === recommendedStyle;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, styleProfile: id }))}
                      className={`rounded-2xl border p-5 text-left transition-all ${selected ? 'border-stone-800 bg-white shadow-md' : 'border-stone-200 bg-white hover:border-stone-400'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Palette className="h-5 w-5 text-stone-500" />
                        {recommended && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Recommended</span>}
                      </div>
                      <p className="mt-4 font-semibold text-stone-800">{profile.title}</p>
                      <p className="mt-2 text-xs leading-5 text-stone-500">{profile.description}</p>
                      <div className="mt-4 space-y-2">
                        {profile.criteria.slice(0, 3).map((criterion) => (
                          <div key={criterion} className="flex items-start gap-2 text-[11px] leading-4 text-stone-600">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                            {criterion}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </WizardStep>
          )}

          {step === 4 && (
            <WizardStep title="Describe the idea" note="Keep it human. The structured brief can grow from this seed.">
              <label className="block">
                <span className="text-xs font-semibold text-stone-700">Project title <span className="font-normal text-stone-400">optional</span></span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={draft.subjectName || 'A simple working title'}
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 outline-none focus:border-stone-500"
                />
              </label>
              <label className="mt-5 block">
                <span className="text-xs font-semibold text-stone-700">The idea</span>
                <textarea
                  value={draft.idea}
                  onChange={(event) => setDraft((current) => ({ ...current, idea: event.target.value }))}
                  rows={6}
                  placeholder="Emma notices one unusually beautiful flower while walking through Sunday Walking Street. Quiet, slightly funny, notebook-sketch feeling…"
                  className="mt-2 w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-stone-800 outline-none focus:border-stone-500"
                />
              </label>

              <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Project contract</p>
                <div className="mt-3 grid gap-3 text-xs text-stone-600 sm:grid-cols-2">
                  <SummaryLine label="Output" value={draft.assetType || '—'} />
                  <SummaryLine label="Subject" value={`${draft.subjectType || '—'} · ${draft.subjectName || '—'}`} />
                  <SummaryLine label="Purpose" value={draft.purpose || '—'} />
                  <SummaryLine label="Style" value={draft.styleProfile ? styleProfiles[draft.styleProfile].title : '—'} />
                </div>
              </div>
            </WizardStep>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={step === 0 ? onClose : previous}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700"
          >
            {step > 0 && <ChevronLeft className="h-4 w-4" />}
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => onCreate(draft)}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <Plus className="h-4 w-4" />
              Create project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardProgress({ step }: { step: number }) {
  const labels = ['Output', 'Subject', 'Purpose', 'Style', 'Idea'];

  return (
    <div className="mb-8 grid grid-cols-5 gap-2">
      {labels.map((label, index) => (
        <div key={label}>
          <div className={`h-1.5 rounded-full ${index <= step ? 'bg-stone-800' : 'bg-stone-200'}`} />
          <p className={`mt-2 text-[10px] font-semibold ${index <= step ? 'text-stone-700' : 'text-stone-400'}`}>{label}</p>
        </div>
      ))}
    </div>
  );
}

function WizardStep({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-3xl text-stone-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{note}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function OptionGrid<T extends string>({ options, selected, onSelect }: { options: T[]; selected: T | ''; onSelect: (option: T) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {options.map((option) => {
        const active = option === selected;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-2xl border p-4 text-left text-sm font-semibold transition-all ${
              active ? 'border-stone-800 bg-white text-stone-900 shadow-sm' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400'
            }`}
          >
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
              {active ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
            </div>
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</p>
      <p className="mt-1 font-medium text-stone-700">{value}</p>
    </div>
  );
}
