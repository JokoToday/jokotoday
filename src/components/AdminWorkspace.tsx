import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  Gift,
  Images,
  LayoutDashboard,
  MessageSquareQuote,
  Monitor,
  PackageCheck,
  Palette,
  ShoppingBasket,
  QrCode,
  Rocket,
  Sparkles,
  CreditCard,
  Users,
} from 'lucide-react';
import { CommerceIntelligenceManagement } from './CommerceIntelligenceManagement';
import { ConcretePickupDateManagement } from './ConcretePickupDateManagement';
import { CuriosityManagement } from './CuriosityManagement';
import { CustomerExperienceManagement } from './CustomerExperienceManagement';
import { LoyaltyRewardsManagement } from './LoyaltyRewardsManagement';
import { GalleryManagement } from './GalleryManagement';
import { NonBakeryManagement } from './NonBakeryManagement';
import { WhatPeopleSayManagement } from './WhatPeopleSayManagement';
import { NotebookContentManagement } from './NotebookContentManagement';
import { ProductPickupAvailabilityManagement } from './ProductPickupAvailabilityManagement';
import { PickupV2RolloutManagement } from './PickupV2RolloutManagement';
import { QrPassDesignerManagement } from './QrPassDesignerManagement';
import { AdminPage as AdminCmsPage } from '../pages/AdminCmsPage';
import '../app/joko-today/admin/jokoAdmin.css';
import { useInternalJokoBranding } from '../app/joko-today/internal/useInternalJokoBranding';
import { InternalSignedInAccount } from './InternalSignedInAccount';
import { EasySlipTestManagement } from './EasySlipTestManagement';

const HomepageBuilderAdmin = lazy(() => import('../app/joko-today/admin/HomepageBuilderAdmin'));

interface AdminWorkspaceProps {
  onNavigate: (page: string) => void;
}

type WorkspaceTab =
  | 'cms'
  | 'homepage'
  | 'non-bakery'
  | 'gallery'
  | 'what-people-say'
  | 'curiosities'
  | 'notebook-content'
  | 'customer-experience'
  | 'qr-pass'
  | 'pickup-products'
  | 'pickup-dates'
  | 'pickup-rollout'
  | 'commerce-intelligence'
  | 'payments-test'
  | 'loyalty';

function workspaceTabFromLocation(): WorkspaceTab {
  const path = window.location.pathname;
  if (path.startsWith('/admin/homepage')) return 'homepage';
  if (path.startsWith('/admin/non-bakery')) return 'non-bakery';
  if (path.startsWith('/admin/gallery')) return 'gallery';
  if (path.startsWith('/admin/what-people-say')) return 'what-people-say';
  if (path.startsWith('/admin/curiosities')) return 'curiosities';
  if (path.startsWith('/admin/notebook')) return 'notebook-content';
  if (path.startsWith('/admin/customer-experience')) return 'customer-experience';
  if (path.startsWith('/admin/qr-pass')) return 'qr-pass';
  if (path.startsWith('/admin/pickup-products')) return 'pickup-products';
  if (path.startsWith('/admin/pickup-dates')) return 'pickup-dates';
  if (path.startsWith('/admin/pickup-rollout')) return 'pickup-rollout';
  if (path.startsWith('/admin/commerce-intelligence')) return 'commerce-intelligence';
  if (path.startsWith('/admin/payments-test')) return 'payments-test';
  if (path.startsWith('/admin/loyalty')) return 'loyalty';
  return 'cms';
}

function workspacePath(tab: WorkspaceTab): string {
  switch (tab) {
    case 'homepage': return '/admin/homepage';
    case 'non-bakery': return '/admin/non-bakery';
    case 'gallery': return '/admin/gallery';
    case 'what-people-say': return '/admin/what-people-say';
    case 'curiosities': return '/admin/curiosities';
    case 'notebook-content': return '/admin/notebook';
    case 'customer-experience': return '/admin/customer-experience';
    case 'qr-pass': return '/admin/qr-pass';
    case 'pickup-products': return '/admin/pickup-products';
    case 'pickup-dates': return '/admin/pickup-dates';
    case 'pickup-rollout': return '/admin/pickup-rollout';
    case 'commerce-intelligence': return '/admin/commerce-intelligence';
    case 'payments-test': return '/admin/payments-test';
    case 'loyalty': return '/admin/loyalty';
    case 'cms':
    default:
      return '/admin';
  }
}

export function AdminWorkspace({ onNavigate }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(workspaceTabFromLocation);
  const { logoUrl, brandingStyle } = useInternalJokoBranding();

  useEffect(() => {
    const handlePopState = () => setActiveTab(workspaceTabFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectWorkspaceTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    const targetPath = workspacePath(tab);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const tabClass = (tab: WorkspaceTab) =>
    `joko-admin-nav-chip ${activeTab === tab ? 'joko-admin-nav-chip--active' : ''}`;

  return (
    <div className="joko-admin-shell" style={brandingStyle}>
      <header className="joko-admin-topbar sticky top-0 z-40">
        <div className="mx-auto max-w-[92rem] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="rounded-xl focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#CFE3DF]"
                aria-label="Open JOKO TODAY"
              >
                <img
                  src={logoUrl}
                  alt="JOKO TODAY"
                  className="joko-admin-brand-logo"
                />
              </button>
              <div className="border-l border-[#55766F]/20 pl-4">
                <p className="joko-admin-eyebrow">Workspace</p>
                <p className="joko-admin-title text-xl font-semibold">Admin</p>
              </div>
              <InternalSignedInAccount className="max-w-[13rem]" />
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="joko-admin-secondary-button ml-1 hidden items-center gap-2 px-3 py-2 text-xs sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open site
              </button>
            </div>

            <nav className="min-w-0 flex-1 overflow-x-auto xl:ml-5" aria-label="JOKO Admin">
              <div className="flex min-w-max gap-1.5 py-1">
                <button type="button" onClick={() => selectWorkspaceTab('cms')} className={tabClass('cms')}>
                  <LayoutDashboard className="h-4 w-4" />
                  Content & Commerce
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('homepage')} className={tabClass('homepage')}>
                  <Monitor className="h-4 w-4" />
                  Website / Homepage
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('non-bakery')} className={tabClass('non-bakery')}>
                  <ShoppingBasket className="h-4 w-4" />
                  Not Bread
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('gallery')} className={tabClass('gallery')}>
                  <Images className="h-4 w-4" />
                  Gallery
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('what-people-say')} className={tabClass('what-people-say')}>
                  <MessageSquareQuote className="h-4 w-4" />
                  What People Say
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('customer-experience')} className={tabClass('customer-experience')}>
                  <Users className="h-4 w-4" />
                  Customer Experience
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('qr-pass')} className={tabClass('qr-pass')}>
                  <QrCode className="h-4 w-4" />
                  QR Pass
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('pickup-products')} className={tabClass('pickup-products')}>
                  <PackageCheck className="h-4 w-4" />
                  Pickup Capacity
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('pickup-dates')} className={tabClass('pickup-dates')}>
                  <CalendarDays className="h-4 w-4" />
                  Pickup Dates
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('pickup-rollout')} className={tabClass('pickup-rollout')}>
                  <Rocket className="h-4 w-4" />
                  Pickup Rollout
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('commerce-intelligence')} className={tabClass('commerce-intelligence')}>
                  <Sparkles className="h-4 w-4" />
                  Commerce Intelligence
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('payments-test')} className={tabClass('payments-test')}>
                  <CreditCard className="h-4 w-4" />
                  Payment Test
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('loyalty')} className={tabClass('loyalty')}>
                  <Gift className="h-4 w-4" />
                  Loyalty & Rewards
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('creative')}
                  className="joko-admin-nav-chip border border-[#55766F]/18 bg-[#F4EFE5]/55"
                >
                  <Palette className="h-4 w-4" />
                  Creative Lab
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('curiosities')} className={tabClass('curiosities')}>
                  <Sparkles className="h-4 w-4" />
                  Curiosities
                </button>
                <button type="button" onClick={() => selectWorkspaceTab('notebook-content')} className={tabClass('notebook-content')}>
                  <BookOpen className="h-4 w-4" />
                  Legacy Notebook
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <main className="joko-admin-content pb-14">
        {activeTab === 'cms' && <AdminCmsPage onNavigate={onNavigate} />}
        {activeTab === 'non-bakery' && <NonBakeryManagement />}

        {activeTab === 'homepage' && (
          <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
            <HomepageBuilderAdmin />
          </Suspense>
        )}

        {activeTab === 'gallery' && (
          <AdminSection
            eyebrow="About JOKO"
            title="Gallery"
            description="Curate the real photos and videos used on the Gallery page and select a small number for the homepage. This content is managed independently from the Homepage Builder."
          >
            <GalleryManagement />
          </AdminSection>
        )}

        {activeTab === 'what-people-say' && (
          <AdminSection
            eyebrow="Social proof"
            title="What People Say"
            description="Curate real Google Maps reviews, TikTok, RedNote, YouTube and other third-party mentions. Preserve original source URLs and choose which items appear on the homepage."
          >
            <WhatPeopleSayManagement />
          </AdminSection>
        )}

        {activeTab === 'curiosities' && (
          <AdminSection
            eyebrow="Editorial system"
            title="Curiosity Publishing"
            description="Create, review and publish canonical Curiosity Episodes. This capability remains available even though Curiosity is not part of the current public bakery homepage."
          >
            <CuriosityManagement />
          </AdminSection>
        )}

        {activeTab === 'notebook-content' && (
          <AdminSection
            eyebrow="Compatibility"
            title="Legacy Notebook / Homepage Content"
            description="The Notebook system is retained. This editor remains available for compatibility and future editorial work; it is not part of the current public bakery homepage."
          >
            <NotebookContentManagement />
          </AdminSection>
        )}

        {activeTab === 'customer-experience' && <CustomerExperienceManagement />}
        {activeTab === 'qr-pass' && <QrPassDesignerManagement />}

        {activeTab === 'pickup-products' && (
          <AdminSection
            eyebrow="Pickup"
            title="Product Pickup Capacity"
            description="Manage product availability, recurring shared capacity and date-specific exceptions."
          >
            <ProductPickupAvailabilityManagement />
          </AdminSection>
        )}

        {activeTab === 'pickup-dates' && (
          <AdminSection
            eyebrow="Pickup"
            title="Concrete Pickup Dates"
            description="Manage materialized pickup dates and date-specific exceptions."
          >
            <div className="joko-admin-paper-card p-5 sm:p-6">
              <ConcretePickupDateManagement />
            </div>
          </AdminSection>
        )}

        {activeTab === 'pickup-rollout' && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <PickupV2RolloutManagement />
          </div>
        )}

        {activeTab === 'commerce-intelligence' && (
          <AdminSection
            eyebrow="Merchandising"
            title="Commerce Intelligence"
            description="Configure pickup-aware recommendations and merchandising priorities without hard-coding commercial rules."
          >
            <CommerceIntelligenceManagement />
          </AdminSection>
        )}

        {activeTab === 'payments-test' && (
          <AdminSection
            eyebrow="Payments"
            title="EasySlip Verification Test"
            description="Internal proof-of-concept for verifying a real payment slip against the registered JOKO receiving account. Test only; it does not update orders or payment status."
          >
            <EasySlipTestManagement />
          </AdminSection>
        )}

        {activeTab === 'loyalty' && (
          <AdminSection
            eyebrow="Customer value"
            title="Loyalty & Rewards"
            description="Configure how customers earn points and what those points can be exchanged for."
          >
            <LoyaltyRewardsManagement />
          </AdminSection>
        )}
      </main>
    </div>
  );
}

function AdminSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7">
        <p className="joko-admin-eyebrow">{eyebrow}</p>
        <h1 className="joko-admin-title mt-1 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#303532]/62">{description}</p>
      </div>
      {children}
    </div>
  );
}
