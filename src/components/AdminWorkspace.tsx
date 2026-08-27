import { useState } from 'react';
import { CalendarDays, Gift, LayoutDashboard } from 'lucide-react';
import { ConcretePickupDateManagement } from './ConcretePickupDateManagement';
import { LoyaltyRewardsManagement } from './LoyaltyRewardsManagement';
import { AdminPage as AdminCmsPage } from '../pages/AdminCmsPage';

interface AdminWorkspaceProps {
  onNavigate: (page: string) => void;
}

type WorkspaceTab = 'cms' | 'pickup-dates' | 'loyalty';

export function AdminWorkspace({ onNavigate }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('cms');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('cms')}
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
              onClick={() => setActiveTab('pickup-dates')}
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
              onClick={() => setActiveTab('loyalty')}
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
