import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Folder,
  Image,
  LayoutGrid,
  Loader2,
  Lock,
  MessageSquare,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CharacterBuilderWizard } from './CharacterBuilderWizard';
import { CreateModeChooser } from './CreateModeChooser';
import { SceneBuilderWizard } from './SceneBuilderWizard';
import {
  characterSpecTags,
  getStyleProfile,
  initialProjects,
  isMeaningful,
  makeCharacterBrief,
  makeProjectTitle,
  makeSceneBrief,
  styleProfiles,
  type CharacterProjectDraft,
  type CreativeSection,
  type ProjectAccent,
  type ProjectCard,
  type ProjectDraft,
  type ProjectStatus,
} from './creativeLabModel';

interface CreativeLabPageProps {
  onNavigate: (page: string) => void;
}

type CreateMode = 'choose' | 'scene' | 'character' | null;

const navItems: Array<{ id: CreativeSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'studio', label: 'Studio', icon: LayoutGrid },
  { id: 'projects', label: 'Projects', icon: Folder },
  { id: 'review', label: 'Review', icon: MessageSquare },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'style', label: 'Style', icon: Palette },
];

function projectSteps(project: ProjectCard) {
  return [project.projectType === 'character' ? 'Character' : 'Scene', 'Brief', 'Create', 'Review', 'Approved'];
}

function accentClass(accent: ProjectAccent) {
  switch (accent) {
    case 'sage': return 'from-emerald-50 via-stone-50 to-amber-50';
    case 'sand': return 'from-amber-50 via-orange-50 to-stone-100';
    case 'rose': return 'from-rose-50 via-orange-50 to-amber-50';
    default: return 'from-slate-50 via-stone-50 to-zinc-100';
  }
}

function accentForStyle(styleProfile: string): ProjectAccent {
  if (styleProfile === 'jokomi-master-v1') return 'sand';
  if (styleProfile === 'curious-community-v1') return 'sage';
  return 'ink';
}

function sectionHeading(section: CreativeSection) {
  switch (section) {
    case 'projects': return ['Projects', 'Everything currently moving from direction to approval.'] as const;
    case 'review': return ['Review', 'Decide what is good enough to become part of the JOKO world.'] as const;
    case 'library': return ['Library', 'The visual memory of approved and in-progress creative work.'] as const;
    case 'style': return ['Style', 'The visual language is production infrastructure — and one of our moats.'] as const;
    default: return ['What are we making today?', 'Build a scene or define a reusable character. Creative Lab turns structured choices into the working brief.'] as const;
  }
}

export default function CreativeLabPage({ onNavigate }: CreativeLabPageProps) {
  const { user, userRole, loading, profileLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<CreativeSection>('studio');
  const [projectList, setProjectList] = useState<ProjectCard[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  const selectedProject = projectList.find((project) => project.id === selectedProjectId) ?? projectList[0];
  const [heading, subheading] = sectionHeading(activeSection);

  const openProject = (project: ProjectCard, destination: CreativeSection = 'studio') => {
    setSelectedProjectId(project.id);
    setActiveSection(destination);
  };

  const addProject = (newProject: ProjectCard) => {
    setProjectList((current) => [newProject, ...current]);
    setSelectedProjectId(newProject.id);
    setActiveSection('studio');
    setCreateMode(null);
  };

  const createSceneProject = ({ scene, styleProfile }: ProjectDraft) => {
    addProject({
      id: `creative-${Date.now()}`,
      projectType: 'scene',
      title: makeProjectTitle(scene),
      subtitle: `${scene.subjectType || 'Story'} · ${scene.assetType || 'Illustration'}`,
      status: 'In progress',
      progress: 10,
      accent: accentForStyle(styleProfile),
      assetType: scene.assetType || 'Illustration',
      subjectType: scene.subjectType || 'Story',
      subjectName: scene.subjectName || 'Untitled',
      purpose: scene.purpose || 'Notebook',
      styleProfile,
      idea: makeSceneBrief(scene),
      scene,
      createdLabel: 'Created in this prototype session',
    });
  };

  const createCharacterProject = ({ character }: CharacterProjectDraft) => {
    const styleProfile = character.style.profileId;
    addProject({
      id: `creative-character-${Date.now()}`,
      projectType: 'character',
      title: character.identity.name,
      subtitle: `Character · ${character.presentation.outputType}`,
      status: 'In progress',
      progress: 10,
      accent: accentForStyle(styleProfile),
      assetType: character.presentation.outputType,
      subjectType: 'Character',
      subjectName: character.identity.name,
      purpose: 'Character library',
      styleProfile,
      idea: makeCharacterBrief(character),
      scene: {},
      character,
      createdLabel: 'Created in this prototype session',
    });
  };

  if (loading || (user && profileLoading)) {
    return <Centered><Loader2 className="h-5 w-5 animate-spin" />Opening Creative Lab…</Centered>;
  }

  if (!user || userRole !== 'admin') {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <Lock className="mb-5 h-5 w-5 text-stone-600" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">JOKO Creative Lab</p>
          <h1 className="mt-2 font-serif text-2xl text-stone-950">Admin access required</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">Creative Lab uses the existing JOKO TODAY admin identity.</p>
          <button type="button" onClick={() => onNavigate('admin')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white">
            Open Admin sign in <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <Sidebar activeSection={activeSection} onSelect={setActiveSection} onBack={() => onNavigate('admin')} />

        <main className="min-w-0">
          <header className="border-b border-stone-200 bg-white px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">{activeSection}</p>
                <h1 className="font-serif text-3xl text-stone-950 sm:text-4xl">{heading}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subheading}</p>
              </div>
              <button type="button" onClick={() => setCreateMode('choose')} className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-sm">
                <Plus className="h-4 w-4" />Create something
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
            <PrototypeNotice />
            {activeSection === 'studio' && <StudioView projects={projectList} selectedProject={selectedProject} onOpenProject={openProject} />}
            {activeSection === 'projects' && <ProjectsView projects={projectList} onOpenProject={openProject} />}
            {activeSection === 'review' && <ReviewView projects={projectList} />}
            {activeSection === 'library' && <LibraryView projects={projectList} onOpenProject={openProject} />}
            {activeSection === 'style' && <StyleView selectedProject={selectedProject} />}
          </div>
        </main>
      </div>

      {createMode === 'choose' && <CreateModeChooser onClose={() => setCreateMode(null)} onSelect={setCreateMode} />}
      {createMode === 'scene' && <SceneBuilderWizard onClose={() => setCreateMode(null)} onCreate={createSceneProject} />}
      {createMode === 'character' && <CharacterBuilderWizard onClose={() => setCreateMode(null)} onCreate={createCharacterProject} />}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center gap-3 bg-stone-100 p-6 text-stone-700">{children}</div>;
}

function Sidebar({ activeSection, onSelect, onBack }: { activeSection: CreativeSection; onSelect: (section: CreativeSection) => void; onBack: () => void }) {
  return (
    <aside className="border-b border-stone-200 bg-stone-50 lg:border-b-0 lg:border-r">
      <div className="px-5 py-5 lg:px-6 lg:py-8">
        <p className="font-serif text-2xl leading-none text-stone-950">JOKO</p>
        <p className="mt-1 font-serif text-lg text-stone-700">Creative Lab</p>
        <button type="button" onClick={onBack} className="mt-5 text-xs font-medium text-stone-500">Back to Admin</button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:px-4">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onSelect(id)} className={`inline-flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium lg:w-full ${activeSection === id ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-600 hover:bg-white'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>
      <div className="hidden px-6 py-8 lg:block">
        <div className="border-t border-stone-200 pt-6">
          <p className="font-serif text-lg italic leading-7 text-stone-500">“Preserve the visual weirdness.”</p>
          <p className="mt-3 text-xs leading-5 text-stone-400">Curated choices first. Freedom second. Blank prompt boxes last.</p>
        </div>
      </div>
    </aside>
  );
}

function PrototypeNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
      <span><strong>Prototype mode:</strong> projects created here live only in this browser session.</span>
      <span className="font-semibold">No Supabase writes yet</span>
    </div>
  );
}

function StudioView({ projects, selectedProject, onOpenProject }: { projects: ProjectCard[]; selectedProject: ProjectCard; onOpenProject: (project: ProjectCard) => void }) {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-3">
        {(['In progress', 'Ready for review', 'Approved'] as ProjectStatus[]).map((status) => (
          <ProjectLane key={status} title={status === 'Approved' ? 'Recently approved' : status} projects={projects.filter((project) => project.status === status)} onOpenProject={onOpenProject} />
        ))}
      </section>
      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <ProjectWorkspace project={selectedProject} />
        <StyleGuardian project={selectedProject} />
      </section>
    </>
  );
}

function ProjectLane({ title, projects, onOpenProject }: { title: string; projects: ProjectCard[]; onOpenProject: (project: ProjectCard) => void }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-500">{projects.length}</span></div>
      <div className="space-y-2">
        {projects.map((project) => (
          <button key={project.id} type="button" onClick={() => onOpenProject(project)} className="w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-left hover:shadow-sm">
            <div className={`h-16 bg-gradient-to-br ${accentClass(project.accent)}`} />
            <div className="p-3"><p className="text-sm font-semibold text-stone-800">{project.title}</p><p className="mt-1 text-[11px] text-stone-500">{project.projectType === 'character' ? 'Character' : project.subjectType} · {project.assetType}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectWorkspace({ project }: { project: ProjectCard }) {
  const currentStep = project.status === 'Approved' ? 4 : project.status === 'Ready for review' ? 3 : Math.max(0, Math.min(2, Math.floor(project.progress / 25)));
  const tags = project.projectType === 'character' && project.character
    ? characterSpecTags(project.character)
    : Object.values(project.scene).filter((value) => isMeaningful(value)).slice(0, 12) as string[];
  const steps = projectSteps(project);

  return (
    <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Selected {project.projectType}</p>
        <h2 className="mt-1 font-serif text-2xl text-stone-950">{project.title}</h2>
        <p className="mt-1 text-sm text-stone-500">{project.subjectName} · {project.purpose} · {project.createdLabel}</p>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {steps.map((step, index) => (
            <div key={step} className="text-center">
              <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border ${index < currentStep || project.status === 'Approved' ? 'border-emerald-600 bg-emerald-600 text-white' : index === currentStep ? 'border-emerald-600 bg-white text-emerald-700' : 'border-stone-300 text-stone-300'}`}>
                {index < currentStep || project.status === 'Approved' ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5" fill="currentColor" />}
              </div>
              <p className="mt-2 text-[10px] font-medium text-stone-500">{step}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Generated {project.projectType === 'character' ? 'character direction' : 'creative brief'}</p>
          <p className="mt-3 text-sm leading-6 text-stone-700">{project.idea}</p>
          {tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600">{tag}</span>)}</div>}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <WorkspaceCard icon={FileText} title="Brief">Structured {project.projectType === 'character' ? 'character choices' : 'scene choices'} become the working brief automatically.</WorkspaceCard>
          <WorkspaceCard icon={Image} title="Source Material">Character masters, references, photos and research will attach here.</WorkspaceCard>
          <WorkspaceCard icon={MessageSquare} title="Review">Technical QA → Style Check → Editorial → Human approval.</WorkspaceCard>
        </div>
      </div>
    </div>
  );
}

function WorkspaceCard({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4"><Icon className="h-4 w-4 text-stone-500" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-stone-500">{children}</p></div>;
}

function ProjectsView({ projects, onOpenProject }: { projects: ProjectCard[]; onOpenProject: (project: ProjectCard) => void }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <button key={project.id} type="button" onClick={() => onOpenProject(project)} className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm"><div className={`mb-4 aspect-[16/6] rounded-xl bg-gradient-to-br ${accentClass(project.accent)}`} /><p className="font-semibold">{project.title}</p><p className="mt-1 text-xs text-stone-500">{project.projectType === 'character' ? 'Character' : project.subjectType} · {project.assetType}</p><p className="mt-4 text-[11px] font-medium text-stone-500">{getStyleProfile(project.styleProfile).title}</p></button>)}</section>;
}

function ReviewView({ projects }: { projects: ProjectCard[] }) {
  const reviewProjects = projects.filter((project) => project.status === 'Ready for review');
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Review queue</p>
      <h2 className="mt-2 font-serif text-2xl">{reviewProjects.length} {reviewProjects.length === 1 ? 'piece needs' : 'pieces need'} a decision</h2>
      <div className="mt-6 space-y-3">{reviewProjects.map((project) => <div key={project.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="font-semibold">{project.title}</p></div><p className="mt-2 text-xs text-stone-500">{getStyleProfile(project.styleProfile).title}</p><p className="mt-3 text-sm leading-6 text-stone-600">{project.idea}</p></div>)}</div>
    </section>
  );
}

function LibraryView({ projects, onOpenProject }: { projects: ProjectCard[]; onOpenProject: (project: ProjectCard) => void }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => projects.filter((project) => [project.projectType, project.title, project.subjectName, project.assetType, project.purpose, project.idea, getStyleProfile(project.styleProfile).title].join(' ').toLowerCase().includes(normalizedQuery)), [normalizedQuery, projects]);
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="font-serif text-2xl">Media Library</h2><p className="mt-1 text-sm text-stone-500">Search by character, subject, scene detail, output or style.</p></div><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" className="rounded-xl border border-stone-300 py-2.5 pl-9 pr-3 text-sm" /></label></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{filtered.map((project) => <button key={project.id} type="button" onClick={() => onOpenProject(project)} className="rounded-2xl border border-stone-200 p-4 text-left"><BookOpen className="h-5 w-5 text-stone-400" /><p className="mt-4 text-sm font-semibold">{project.title}</p><p className="mt-1 text-[11px] text-stone-500">{project.projectType === 'character' ? 'Character · ' : ''}{getStyleProfile(project.styleProfile).title}</p></button>)}</div>
    </section>
  );
}

function StyleView({ selectedProject }: { selectedProject: ProjectCard }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4"><Sparkles className="mt-1 h-6 w-6" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">JOKO visual moat</p><h2 className="mt-1 font-serif text-3xl">Style is production infrastructure.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">Curious Community is the main people/character profile. Living Notebook governs the broader editorial world; Jokomi retains his separate master canon.</p></div></div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{Object.entries(styleProfiles).map(([id, style]) => <div key={id} className="rounded-2xl border border-stone-200 bg-white p-5"><Palette className="h-5 w-5 text-stone-500" /><p className="mt-4 font-semibold">{style.title}</p><p className="mt-2 text-xs leading-5 text-stone-500">{style.description}</p></div>)}</div>
      </div>
      <StyleGuardian project={selectedProject} />
    </section>
  );
}

function StyleGuardian({ project }: { project: ProjectCard }) {
  const style = getStyleProfile(project.styleProfile);
  return (
    <aside className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><h2 className="font-serif text-xl">Style Guardian</h2></div>
      <p className="mt-4 text-sm font-semibold">{style.title}</p><p className="mt-2 text-xs leading-5 text-stone-500">{style.description}</p>
      <div className="mt-5 space-y-2.5">{style.criteria.map((criterion) => <div key={criterion} className="flex items-start gap-2 text-xs leading-5 text-stone-600"><Check className="mt-1 h-3 w-3 shrink-0 text-emerald-600" />{criterion}</div>)}</div>
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">Style profile attached</p><p className="mt-1 text-[11px] leading-4 text-emerald-700">Final Style: Pass remains a human review decision.</p></div>
    </aside>
  );
}
