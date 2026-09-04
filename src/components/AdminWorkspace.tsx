import { lazy, Suspense, useEffect, useState } from 'react';
import { CalendarDays, Gift, LayoutDashboard, Monitor, PackageCheck, Rocket, Sparkles } from 'lucide-react';
import { CommerceIntelligenceManagement } from './CommerceIntelligenceManagement';
import { ConcretePickupDateManagement } from './ConcretePickupDateManagement';
import { LoyaltyRewardsManagement } from './LoyaltyRewardsManagement';
import { ProductPickupAvailabilityManagement } from './ProductPickupAvailabilityManagement';
import { PickupV2RolloutManagement } from './PickupV2RolloutManagement';
import { AdminPage as AdminCmsPage } from '../pages/AdminCmsPage';

const HomepageBuilderAdmin = lazy(() => import('../app/joko-today/admin/HomepageBuilderAdmin'));

interface AdminWorkspaceProps {
  onNavigate: (page: string) => void;
}

type WorkspaceTab = 'cms' | 'homepage' | 'pickup-products' | 'pickup-dates' | 'pickup-rollout' | 'commerce-intelligence' | 'loyalty';

function workspaceTabFromLocation(): WorkspaceTab {
  return window.location.pathname.startsWith('/admin/homepage') ? 'homepage' : 'cms';
}

export function AdminWorkspace({ onNavigate }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(workspaceTabFromLocation);

  useEffect(() => {
    const handlePopState = () => setActiveTab(workspaceTabFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectWorkspaceTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'homepage' ? '/admin/homepage' : '/admin';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => selectWorkspaceTab('cms')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'cms'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              CMS & Recurring Setup
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('homepage')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'homepage'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Monitor className="w-4 h-4" />
              Website / Homepage
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('pickup-products')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'pickup-products'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              Product Pickup Capacity
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('pickup-dates')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'pickup-dates'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Concrete Pickup Dates
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('pickup-rollout')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'pickup-rollout'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Rocket className="w-4 h-4" />
              Pickup v2 Rollout
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('commerce-intelligence')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'commerce-intelligence'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Commerce Intelligence
            </button>
            <button
              type="button"
              onClick={() => selectWorkspaceTab('loyalty')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'loyalty'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Gift className="w-4 h-4" />
              Loyalty & Rewards
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'cms' && <AdminCmsPage onNavigate={onNavigate} />}

      {activeTab === 'homepage' && (
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          <HomepageBuilderAdmin />
        </Suspense>
      )}

      {activeTab === 'pickup-products' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Product Pickup Capacity</h1>
            <p className="text-gray-600 mt-2">Manage Pickup v2 product availability, recurring shared capacity and date-specific exceptions.</p>
          </div>
          <ProductPickupAvailabilityManagement />
        </div>
      )}

      {activeTab === 'pickup-dates' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">JOKO TODAY Admin</h1>
            <p className="text-gray-600 mt-2">Manage materialized pickup dates and date-specific exceptions.</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <ConcretePickupDateManagement />
          </div>
        </div>
      )}

      {activeTab === 'pickup-rollout' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PickupV2RolloutManagement />
        </div>
      )}

      {activeTab === 'commerce-intelligence' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Commerce Intelligence</h1>
            <p className="text-gray-600 mt-2">Configure Pickup-aware recommendations and merchandising priorities without hard-coding commercial rules.</p>
          </div>
          <CommerceIntelligenceManagement />
        </div>
      )}

      {activeTab === 'loyalty' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Loyalty & Rewards</h1>
            <p className="text-gray-600 mt-2">Configure how customers earn points and what those points can be exchanged for.</p>
          </div>
          <LoyaltyRewardsManagement />
        </div>
      )}
    </div>
  );
}
