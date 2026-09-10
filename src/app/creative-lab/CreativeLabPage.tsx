import { useState } from 'react';
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
  PlayCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreativeLabPageProps {
  onNavigate: (page: string) => void;
}

type CreativeSection = 'studio' | 'projects' | 'review' | 'library' | 'style';

type ProjectStatus = 'In progress' | 'Ready for review' | 'Approved';

interface ProjectCard {
  title: string;
  subtitle: string;
  status: ProjectStatus;
  progress?: number;
  accent: 'sage' | 'sand' | 'rose' | 'ink';
}

const projects: ProjectCard[] = [
  {
    title: 'Emma at Sunday Walking Street',
    subtitle: 'Person · Place · Micro story',
    status: 'In progress',
    progress: 60,
    accent: 'sage',
  },
  {
    title: 'Almond Croissant Reveal',
    subtitle: 'Product · Animated sketch',
    status: 'In progress',
    progress: 30,
    accent: 'sand',
  },
  {
    title: 'Why do croissants have layers?',
    subtitle: 'Question · Explainer',
    status: 'Ready for review',
    accent: 'ink',
  },
  {
    title: 'New Strawberry Cake',
    subtitle: 'Product · Today candidate',
    status: 'Ready for review',
    accent: 'rose',
  },
  {
    title: 'Jokomi Bakery Doorway',
    subtitle: 'Jokomi · Homepage scene',
    status: 'Approved',
    accent: 'sage',
  },
  {
    title: 'A Softer Morning',
    subtitle: 'Story · Notebook image',
    status: 'Approved',
    accent: 'sand',
  },
];

const navItems: Array<{ id: CreativeSection; label: string; icon: typeof LayoutGrid }> = [
  { id: 'studio', label: 'Studio', icon: LayoutGrid },
  { id: 'projects', label: 'Projects', icon: Folder },
  { id: 'review', label: 'Review', icon: MessageSquare },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'style', label: 'Style', icon: Palette },
];

const styleCriteria = [
  'Hand-drawn feel',
  'Soft ink outlines',
  'Selective colour',
  '2D, not glossy 3D',
  'Quiet composition',
  'Micro storytelling',
];

const projectSteps = ['Idea', 'Brief', 'Create', 'Review', 'Approved'];

function accentClass(accent: ProjectCard['accent']) {
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

export default function CreativeLabPage({ onNavigate }: CreativeLabPageProps) {
  const { user, userRole, loading, profileLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<CreativeSection>('studio');

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
    <div className="min-h-screen bg-[#f4f1ea] text-stone-800">
      <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-stone-200/80 bg-[#f8f5ee] lg:border-b-0 lg:border-r">
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
                    selected
                      ? 'bg-white text-stone-950 shadow-sm'
                      : 'text-stone-600 hover:bg-white/70 hover:text-stone-900'
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
          <header className="border-b border-stone-200/80 bg-[#fbf8f2]/90 px-5 py-6 backdrop-blur sm:px-8 lg:px-10 lg:py-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{activeSection}</p>
                <h1 className="font-serif text-3xl text-stone-950 sm:text-4xl">What are we making today?</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  Turn an idea into a brief, source material, outputs, review and an approved JOKO asset.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" />
                Create something
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
            {activeSection === 'studio' && <StudioView />}
            {activeSection === 'projects' && <ProjectsView />}
            {activeSection === 'review' && <ReviewView />}
            {activeSection === 'library' && <LibraryView />}
            {activeSection === 'style' && <StyleView />}
          </div>
        </main>
      </div>
    </div>
  );
}

function StudioView() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-3">
        <ProjectLane title="In progress" projects={projects.filter((project) => project.status === 'In progress')} />
        <ProjectLane title="Ready for review" projects={projects.filter((project) => project.status === 'Ready for review')} />
        <ProjectLane title="Recently approved" projects={projects.filter((project) => project.status === 'Approved')} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-stone-200 bg-[#fbfaf7] shadow-sm">
          <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Selected project</p>
                <h2 className="mt-1 font-serif text-2xl text-stone-950">Emma at Sunday Walking Street</h2>
                <p className="mt-1 text-sm text-stone-500">A quiet walk. Little discoveries. A kinder everyday.</p>
              </div>
              <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">In progress</span>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2">
              {projectSteps.map((step, index) => {
                const complete = index < 2;
                const active = index === 2;
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
              <p className="text-sm leading-6 text-stone-600">
                Emma notices one unusually beautiful flower while walking through Sunday Walking Street. Quiet, observant and gently curious.
              </p>
              <div className="mt-4 space-y-2 text-xs text-stone-500">
                <p>Living Notebook visual language</p>
                <p>Landscape master + short animated sketch</p>
              </div>
            </WorkspaceCard>

            <WorkspaceCard icon={Image} title="Source Material">
              <div className="grid grid-cols-2 gap-2">
                {['Market photo', 'Emma master', 'Flower study', 'Notebook note'].map((label) => (
                  <div key={label} className="aspect-[4/3] rounded-xl border border-stone-200 bg-gradient-to-br from-stone-100 to-amber-50 p-3">
                    <p className="text-[11px] font-medium text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-4 text-xs font-semibold text-stone-700">+ Add material</button>
            </WorkspaceCard>

            <WorkspaceCard icon={PlayCircle} title="Outputs">
              <div className="space-y-2">
                <OutputRow type="Illustration" name="emma-market-master" />
                <OutputRow type="Poster" name="emma-market-poster" />
                <OutputRow type="Animation" name="emma-market-walk-v1" />
              </div>
              <button type="button" className="mt-4 text-xs font-semibold text-stone-700">+ Create new output</button>
            </WorkspaceCard>

            <WorkspaceCard icon={MessageSquare} title="Review">
              <div className="space-y-3">
                <Comment initials="M" text="Warm and alive. The small details are doing the work." />
                <Comment initials="T" text="Feels very JOKO. Keep the flower as the only strong colour." />
              </div>
              <button type="button" className="mt-4 text-xs font-semibold text-stone-700">Open review</button>
            </WorkspaceCard>
          </div>
        </div>

        <StyleGuardian />
      </section>
    </>
  );
}

function ProjectLane({ title, projects: laneProjects }: { title: string; projects: ProjectCard[] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-[#fbfaf7] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-500">{laneProjects.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {laneProjects.map((project) => (
          <div key={project.title} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className={`aspect-[16/8] bg-gradient-to-br ${accentClass(project.accent)} p-3`}>
              <div className="flex h-full items-end">
                <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-medium text-stone-500 backdrop-blur">{project.subtitle.split(' · ')[0]}</span>
              </div>
            </div>
            <div className="p-3">
              <p className="min-h-10 text-sm font-semibold leading-5 text-stone-800">{project.title}</p>
              <p className="mt-1 text-[11px] text-stone-400">{project.subtitle}</p>
              {project.progress !== undefined && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${project.progress}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[10px] font-medium text-stone-400">{project.progress}%</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceCard({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
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

function Comment({ initials, text }: { initials: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-stone-50 p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white">{initials}</div>
      <p className="text-xs leading-5 text-stone-600">{text}</p>
    </div>
  );
}

function StyleGuardian() {
  return (
    <aside className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-stone-600" />
        <h2 className="font-serif text-xl text-stone-900">Visual Language</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-stone-500">The guardian beside every project.</p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-100 to-amber-50 p-3">
          <div className="aspect-square rounded-xl border border-white/70 bg-white/40" />
          <p className="mt-2 text-xs font-semibold text-stone-700">JOKO Living Notebook v1</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-amber-50 to-stone-100 p-3">
          <div className="aspect-square rounded-xl border border-white/70 bg-white/40" />
          <p className="mt-2 text-xs font-semibold text-stone-700">Jokomi Master v1</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Style criteria</p>
        <div className="mt-3 space-y-2.5">
          {styleCriteria.map((criterion) => (
            <div key={criterion} className="flex items-center gap-2 text-xs text-stone-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
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
          <p className="text-sm font-semibold">Style: Pass</p>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-emerald-700">Aligned with the current JOKO visual language.</p>
      </div>
    </aside>
  );
}

function ProjectsView() {
  return (
    <section className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">Projects</h2>
          <p className="mt-1 text-sm text-stone-500">Creative work currently moving from idea to approval.</p>
        </div>
        <Folder className="h-5 w-5 text-stone-400" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <div key={project.title} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className={`mb-4 aspect-[16/7] rounded-xl bg-gradient-to-br ${accentClass(project.accent)}`} />
            <p className="font-semibold text-stone-800">{project.title}</p>
            <p className="mt-1 text-xs text-stone-500">{project.subtitle}</p>
            <span className="mt-4 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">{project.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewView() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Review queue</p>
        <h2 className="mt-2 font-serif text-2xl text-stone-900">Two pieces need a decision</h2>
        <div className="mt-6 space-y-3">
          {projects.filter((project) => project.status === 'Ready for review').map((project) => (
            <div key={project.title} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-stone-800">{project.title}</p>
                <p className="mt-1 text-xs text-stone-500">{project.subtitle}</p>
              </div>
              <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white">
                Review
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <StyleGuardian />
    </section>
  );
}

function LibraryView() {
  return (
    <section className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-stone-900">Media Library</h2>
          <p className="mt-1 text-sm text-stone-500">The visual memory of work in progress and approved JOKO assets.</p>
        </div>
        <BookOpen className="h-5 w-5 text-stone-400" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {projects.map((project) => (
          <div key={project.title} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <div className={`aspect-square bg-gradient-to-br ${accentClass(project.accent)} p-4`}>
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/70 bg-white/30">
                <Image className="h-7 w-7 text-stone-400" />
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold text-stone-800">{project.title}</p>
              <p className="mt-1 text-[11px] text-stone-500">{project.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StyleView() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-stone-200 bg-[#fbfaf7] p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">JOKO visual moat</p>
            <h2 className="mt-1 font-serif text-3xl text-stone-900">Style is production infrastructure.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              Every creative project should inherit a versioned visual language. The system keeps the approved examples, anti-examples, character rules and review criteria close to the work itself.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <StyleProfile title="JOKO Living Notebook v1" description="Quiet observation, hand-drawn warmth, selective colour and meaningful sketch-to-reality transitions." />
          <StyleProfile title="Jokomi Master v1" description="Canonical character proportions, large oval feet, 2D pencil/ink treatment and gentle non-advertising expression." />
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-stone-800">Golden references</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Approved and rejected examples will eventually become a reusable JOKO visual-quality dataset.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ReferenceCard label="YES · Canonical" />
            <ReferenceCard label="YES · Canonical" />
            <ReferenceCard label="NO · Too polished / 3D" muted />
          </div>
        </div>
      </div>

      <StyleGuardian />
    </section>
  );
}

function StyleProfile({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-4 aspect-[16/8] rounded-xl bg-gradient-to-br from-stone-100 via-amber-50 to-emerald-50" />
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
