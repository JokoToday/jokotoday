import { useEffect, useState } from 'react';
import { Settings, Package, Tag, FileText, Type, MapPin, Zap, LogOut, ScanLine, Clock, Share2, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductForm } from '../components/ProductManagement';
import { QuickAddProduct } from '../components/QuickAddProduct';
import { AdminPasswordProtection } from '../components/AdminPasswordProtection';
import { CutoffRulesManagement } from '../components/CutoffRulesManagement';
import { CutoffRulesOverrides } from '../components/CutoffRulesOverrides';
import { CategoryForm } from '../components/CategoryForm';
import { PageForm } from '../components/PageForm';
import { LabelForm } from '../components/LabelForm';
import { SettingForm } from '../components/SettingForm';
import { LocationForm } from '../components/LocationForm';
import { SocialLinksManagement } from '../components/SocialLinksManagement';
import { CancellationCutoffManagement, CancellationCutoffRule, getAllCancellationCutoffRules } from '../components/CancellationCutoffManagement';
import { isAdminAuthenticated, clearAdminAuthentication } from '../lib/adminConfig';
import { getAllSocialLinks, SocialLink } from '../hooks/useSocialLinks';
import {
  CMSCategory,
  CMSProduct,
  CMSPage,
  CMSLabel,
  CMSSetting,
  CMSPickupLocation,
  getCategories,
  getProducts,
  getAllPages,
  getAllLabels,
  getAllSettings,
  getPickupLocations,
} from '../lib/cmsService';
import { getAllCutoffRules, getAllPickupOverrides, CutoffRule, PickupOverride } from '../lib/availabilityService';

type TabType = 'categories' | 'products' | 'pages' | 'labels' | 'settings' | 'locations' | 'cutoffs' | 'overrides' | 'socials' | 'cancellation';
type DeleteHandler = (table: string, id: string) => Promise<void>;
type RefreshHandler = () => Promise<void>;

interface AdminPageProps {
  onNavigate: (page: string) => void;
}

interface ProductsTabProps {
  products: CMSProduct[];
  categories: CMSCategory[];
  locations: CMSPickupLocation[];
  onRefresh: RefreshHandler;
  onDelete: DeleteHandler;
}

interface CategoriesTabProps {
  categories: CMSCategory[];
  onRefresh: RefreshHandler;
  onDelete: DeleteHandler;
}

interface PagesTabProps {
  pages: CMSPage[];
  onRefresh: RefreshHandler;
}

interface LabelsTabProps {
  labels: CMSLabel[];
  onRefresh: RefreshHandler;
  onDelete: DeleteHandler;
}

interface SettingsTabProps {
  settings: CMSSetting[];
  onRefresh: RefreshHandler;
  onDelete: DeleteHandler;
}

interface LocationsTabProps {
  locations: CMSPickupLocation[];
  onRefresh: RefreshHandler;
  onDelete: DeleteHandler;
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [labels, setLabels] = useState<CMSLabel[]>([]);
  const [settings, setSettings] = useState<CMSSetting[]>([]);
  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [cutoffRules, setCutoffRules] = useState<CutoffRule[]>([]);
  const [pickupOverrides, setPickupOverrides] = useState<PickupOverride[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [cancellationRules, setCancellationRules] = useState<CancellationCutoffRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authenticated = isAdminAuthenticated();
    setIsAuthenticated(authenticated);
    if (authenticated) {
      void loadData();
    }
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true);
      const [cats, prods, pageData, lbls, stgs, locs, rules, overrides, socials, cancelRules] = await Promise.all([
        getCategories(),
        getProducts(),
        getAllPages(),
        getAllLabels(),
        getAllSettings(),
        getPickupLocations(),
        getAllCutoffRules(),
        getAllPickupOverrides(),
        getAllSocialLinks(),
        getAllCancellationCutoffRules(),
      ]);

      setCategories(cats);
      setProducts(prods);
      setPages(pageData);
      setLabels(lbls);
      setSettings(stgs);
      setLocations(locs);
      setCutoffRules(rules);
      setPickupOverrides(overrides);
      setSocialLinks(socials);
      setCancellationRules(cancelRules);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete: DeleteHandler = async (table, id) => {
    if (!confirm('Are you sure?')) return;

    try {
      const { error } = await supabase
        .from(table)
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting item');
    }
  };

  const tabs = [
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'categories' as const, label: 'Categories', icon: Tag },
    { id: 'pages' as const, label: 'Pages', icon: FileText },
    { id: 'labels' as const, label: 'Labels', icon: Type },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'locations' as const, label: 'Pickup Locations', icon: MapPin },
    { id: 'socials' as const, label: 'Social Links', icon: Share2 },
    { id: 'cutoffs' as const, label: 'Pickup Schedule', icon: Clock },
    { id: 'overrides' as const, label: 'Holiday Overrides (Legacy)', icon: Clock },
    { id: 'cancellation' as const, label: 'Cancellation Cutoff (Legacy)', icon: Ban },
  ];

  const handleLogout = () => {
    clearAdminAuthentication();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <AdminPasswordProtection
        onAuthenticated={() => {
          setIsAuthenticated(true);
          void loadData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CMS Admin</h1>
            <p className="text-gray-600 mt-2">Manage products, content, pickup schedules and customer-facing configuration.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate('staff-scanner')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg hover:from-amber-700 hover:to-orange-700 transition-colors shadow-sm"
            >
              <ScanLine className="w-4 h-4" />
              Staff Scanner
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 font-medium text-sm whitespace-nowrap flex items-center gap-2 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <>
                {activeTab === 'products' && <ProductsTab products={products} categories={categories} locations={locations} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'categories' && <CategoriesTab categories={categories} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'pages' && <PagesTab pages={pages} onRefresh={loadData} />}
                {activeTab === 'labels' && <LabelsTab labels={labels} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'settings' && <SettingsTab settings={settings} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'locations' && <LocationsTab locations={locations} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'socials' && <SocialLinksManagement socialLinks={socialLinks} onRefresh={loadData} />}
                {activeTab === 'cutoffs' && <CutoffRulesManagement onRefresh={loadData} />}
                {activeTab === 'overrides' && <CutoffRulesOverrides overrides={pickupOverrides} rules={cutoffRules} onRefresh={loadData} />}
                {activeTab === 'cancellation' && <CancellationCutoffManagement rules={cancellationRules} onRefresh={loadData} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ products, categories, locations, onRefresh, onDelete }: ProductsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editing, setEditing] = useState<CMSProduct | null>(null);

  const getCategoryName = (id: string) => {
    const category = categories.find((item) => item.id === id);
    return category ? `${category.title_en} / ${category.title_th}` : 'Unknown';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all font-medium flex items-center gap-2 shadow-sm"
          >
            <Zap className="w-4 h-4" />
            Quick Add
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            + Add Product
          </button>
        </div>
      </div>

      {showQuickAdd && (
        <QuickAddProduct
          categories={categories}
          onSave={() => {
            setShowQuickAdd(false);
            void onRefresh();
          }}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}

      {showForm && (
        <ProductForm
          product={editing}
          categories={categories}
          locations={locations}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Price</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Pickup Slots</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">No products yet. Add your first product!</td></tr>
            ) : products.map((product) => (
              <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">{product.name_en}</p>
                  <p className="text-xs text-gray-600">{product.name_th}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{getCategoryName(product.category_id)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-primary-600">฿{Number(product.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="text-xs">
                    <div className="font-medium text-gray-900">{product.stock_total}</div>
                    <div className={`text-xs font-medium ${product.stock_remaining === 0 ? 'text-red-600' : product.stock_remaining <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                      {product.stock_remaining} left
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {product.available_days?.length ? (
                    <div className="space-y-0.5">
                      {product.available_days.map((day, index) => <div key={`${day}-${index}`} className="text-gray-600 text-xs">{day}</div>)}
                    </div>
                  ) : <span className="text-gray-400 italic">All configured slots</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {!product.is_active && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">Hidden</span>}
                    {product.is_sold_out && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Sold Out</span>}
                    {product.is_active && !product.is_sold_out && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Active</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => {
                      setEditing(product);
                      setShowForm(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete('cms_products', product.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab({ categories, onRefresh, onDelete }: CategoriesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSCategory | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Category
        </button>
      </div>

      {showForm && (
        <CategoryForm
          category={editing}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Slug</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Sort</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500 text-sm">No categories yet.</td></tr>
            ) : categories.map((category) => (
              <tr key={category.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">{category.title_en}</p>
                  <p className="text-xs text-gray-600">{category.title_th}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">{category.slug}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-600">{category.sort_order}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => {
                      setEditing(category);
                      setShowForm(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete('cms_categories', category.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PagesTab({ pages, onRefresh }: PagesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSPage | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Pages</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Page
        </button>
      </div>

      {showForm && (
        <PageForm
          page={editing}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Page</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">English Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Thai Title</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500 text-sm">No pages yet. Add your first page!</td></tr>
            ) : pages.map((page) => (
              <tr key={page.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{page.page_key}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{page.title_en}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{page.title_th}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setEditing(page);
                      setShowForm(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LabelsTab({ labels, onRefresh, onDelete }: LabelsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSLabel | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Labels</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Label
        </button>
      </div>

      {showForm && (
        <LabelForm
          label={editing}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">English</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Thai</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{label.key}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{label.text_en}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{label.text_th}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => {
                      setEditing(label);
                      setShowForm(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete('cms_labels', label.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ settings, onRefresh, onDelete }: SettingsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSSetting | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Setting
        </button>
      </div>

      {showForm && (
        <SettingForm
          setting={editing}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((setting) => (
              <tr key={setting.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{setting.setting_key}</td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">{setting.value}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => {
                      setEditing(setting);
                      setShowForm(true);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete('cms_settings', setting.id)}
                    className="text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationsTab({ locations, onRefresh, onDelete }: LocationsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSPickupLocation | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Pickup Locations</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          + Add Location
        </button>
      </div>

      {showForm && (
        <LocationForm
          location={editing}
          onSave={() => {
            setShowForm(false);
            setEditing(null);
            void onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <div key={location.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900 text-sm">{location.name_en}</h3>
            <p className="text-xs text-gray-600 mt-1">{location.name_th}</p>
            {location.description_en && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{location.description_en}</p>}
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => {
                  setEditing(location);
                  setShowForm(true);
                }}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => void onDelete('cms_pickup_locations', location.id)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
