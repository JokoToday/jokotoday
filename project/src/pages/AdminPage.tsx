import { useState, useEffect } from 'react';
import { Settings, Package, Tag, FileText, Type, MapPin, Zap, LogOut, ScanLine, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getPermissions } from '../lib/rolePermissions';
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
import { isAdminAuthenticated, clearAdminAuthentication } from '../lib/adminConfig';
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

type TabType = 'categories' | 'products' | 'pages' | 'labels' | 'settings' | 'locations' | 'cutoffs' | 'overrides';

interface AdminPageProps {
  onNavigate: (page: string) => void;
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { userRole } = useAuth();
  const permissions = userRole ? getPermissions(userRole) : null;
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
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setIsAuthenticated(isAdminAuthenticated());
    if (isAdminAuthenticated()) {
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, prods, pages, lbls, stgs, locs, rules, overrides] = await Promise.all([
        getCategories(),
        getProducts(),
        getAllPages(),
        getAllLabels(),
        getAllSettings(),
        getPickupLocations(),
        getAllCutoffRules(),
        getAllPickupOverrides(),
      ]);

      setCategories(cats);
      setProducts(prods);
      setPages(pages);
      setLabels(lbls);
      setSettings(stgs);
      setLocations(locs);
      setCutoffRules(rules);
      setPickupOverrides(overrides);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (table: string, id: string) => {
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
    { id: 'cutoffs' as const, label: 'Cutoff Rules', icon: Clock },
    { id: 'overrides' as const, label: 'Holiday Overrides', icon: Clock },
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
          loadData();
        }}
      />
    );
  }

  if (!permissions?.canAccessAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You do not have permission to access the admin panel. Only admin users can access this area.</p>
          <button
            onClick={() => onNavigate('home')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CMS Admin</h1>
            <p className="text-gray-600 mt-2">Manage all content without using AI tokens</p>
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
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <>
                {activeTab === 'products' && <ProductsTab products={products} categories={categories} locations={locations} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'categories' && <CategoriesTab categories={categories} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'pages' && <PagesTab pages={pages} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'labels' && <LabelsTab labels={labels} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'settings' && <SettingsTab settings={settings} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'locations' && <LocationsTab locations={locations} onRefresh={loadData} onDelete={handleDelete} />}
                {activeTab === 'cutoffs' && <CutoffRulesManagement rules={cutoffRules} onRefresh={loadData} />}
                {activeTab === 'overrides' && <CutoffRulesOverrides overrides={pickupOverrides} onRefresh={loadData} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ products, categories, locations, onRefresh, onDelete }: any) {
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editing, setEditing] = useState<CMSProduct | null>(null);

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.title_en} / ${cat.title_th}` : 'Unknown';
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
            onRefresh();
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
            onRefresh();
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Available Days</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No products yet. Add your first product!
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{product.name_en}</p>
                      <p className="text-xs text-gray-600">{product.name_th}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {getCategoryName(product.category_id)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-primary-600">
                    ฿{parseFloat(product.price as any).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="text-xs">
                      <div className="font-medium text-gray-900">{product.stock_total}</div>
                      <div className={`text-xs font-medium ${
                        product.stock_remaining === 0
                          ? 'text-red-600'
                          : product.stock_remaining <= 10
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}>
                        {product.stock_remaining} left
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {product.available_days && product.available_days.length > 0 ? (
                      <div className="space-y-0.5">
                        {product.available_days.map((day, idx) => (
                          <div key={idx} className="text-gray-600 text-xs">{day}</div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {!product.is_active && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          Hidden
                        </span>
                      )}
                      {product.is_sold_out && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                          Sold Out
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditing(product);
                          setShowForm(true);
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 font-medium rounded hover:bg-blue-100 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete('cms_products', product.id)}
                        className="px-3 py-1.5 text-xs bg-red-50 text-red-600 font-medium rounded hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab({ categories, onRefresh, onDelete }: any) {
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
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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
            onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-3">
        {categories.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No categories yet</p>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{cat.title_en}</h3>
                <p className="text-sm text-gray-600">{cat.title_th}</p>
                {cat.description_en && (
                  <p className="text-xs text-gray-500 mt-1">{cat.description_en}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(cat);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete('cms_categories', cat.id)}
                  className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PagesTab({ pages, onRefresh }: any) {
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
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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
            onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-3">
        {pages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No pages yet</p>
        ) : (
          pages.map((page) => (
            <div key={page.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{page.page_key}</h3>
                  <p className="text-sm text-gray-600 mt-1">{page.title_en}</p>
                  <p className="text-sm text-gray-600">{page.title_th}</p>
                </div>
                <button
                  onClick={() => {
                    setEditing(page);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap ml-4"
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LabelsTab({ labels, onRefresh, onDelete }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSLabel | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">UI Labels & Microcopy</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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
            onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-2">
        {labels.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No labels yet</p>
        ) : (
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
                  <tr key={label.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-900">{label.key}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{label.text_en}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{label.text_th}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditing(label);
                            setShowForm(true);
                          }}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete('cms_labels', label.id)}
                          className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ settings, onRefresh, onDelete }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CMSSetting | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings & Configuration</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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
            onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-2">
        {settings.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No settings yet</p>
        ) : (
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
                  <tr key={setting.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-900">{setting.setting_key}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 break-all max-w-xs">{setting.value}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditing(setting);
                            setShowForm(true);
                          }}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete('cms_settings', setting.id)}
                          className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationsTab({ locations, onRefresh, onDelete }: any) {
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
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
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
            onRefresh();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-3">
        {locations.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No locations yet</p>
        ) : (
          locations.map((location) => (
            <div key={location.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{location.name_en}</h3>
                  <p className="text-sm text-gray-600">{location.name_th}</p>
                  {location.description_en && (
                    <p className="text-xs text-gray-500 mt-1">{location.description_en}</p>
                  )}
                  <div className="text-xs text-gray-600 mt-2">
                    <strong>Days:</strong> {location.available_days?.join(', ') || 'Not set'}
                  </div>
                  {location.is_active === false && (
                    <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEditing(location);
                      setShowForm(true);
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete('cms_pickup_locations', location.id)}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
