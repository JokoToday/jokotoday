import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, KeyRound, Loader2, LogOut, Mail, PackageSearch, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InternalSignedInAccount } from '../components/InternalSignedInAccount';
import { ProductEditor } from '../components/products/ProductEditor';
import { getCategories, type CMSCategory, type CMSProduct } from '../lib/cmsService';
import { getProductStaffProducts } from '../lib/productStaffService';
import '../app/joko-today/admin/jokoAdmin.css';
import { useInternalJokoBranding } from '../app/joko-today/internal/useInternalJokoBranding';

interface ProductStaffPageProps {
  onNavigate: (page: string) => void;
}

export function ProductStaffPage({ onNavigate }: ProductStaffPageProps) {
  const { user, loading, userRole, profileLoading, signOut } = useAuth();
  const { logoUrl, brandingStyle } = useInternalJokoBranding();
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [editing, setEditing] = useState<CMSProduct | null>(null);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState('');

  const canEnter = userRole === 'product_staff' || userRole === 'admin';

  const refreshCatalogue = useCallback(async () => {
    setCatalogueLoading(true);
    setCatalogueError('');
    try {
      const [nextProducts, nextCategories] = await Promise.all([
        getProductStaffProducts(),
        getCategories(),
      ]);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (error) {
      console.error('Product Staff catalogue load failed:', error);
      setCatalogueError('Could not load the product catalogue.');
    } finally {
      setCatalogueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && canEnter) void refreshCatalogue();
  }, [user?.id, canEnter, refreshCatalogue]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!needle) return true;
      return [product.name_en, product.name_th, product.name_zh, product.slug]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [products, query, categoryId]);

  if (loading || (user && profileLoading && !canEnter)) {
    return <ProductStaffGate><GateStatus message="Checking Product Staff access…" /></ProductStaffGate>;
  }

  if (!user) {
    return <ProductStaffLogin />;
  }

  if (!canEnter) {
    return (
      <ProductStaffGate>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Product Staff access denied</h1>
          <p className="mt-2 text-sm text-gray-600">This account does not have Product Staff or Admin access.</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="joko-admin-primary-button mt-6 inline-flex items-center gap-2 px-5 py-3"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </ProductStaffGate>
    );
  }

  return (
    <div className="joko-admin-shell min-h-screen" style={brandingStyle}>
      <header className="joko-admin-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => onNavigate('home')} aria-label="Open JOKO TODAY">
              <img src={logoUrl} alt="JOKO TODAY" className="joko-admin-brand-logo" />
            </button>
            <div className="border-l border-[#55766F]/20 pl-4">
              <p className="joko-admin-eyebrow">Workspace</p>
              <p className="joko-admin-title text-xl font-semibold">Product Staff</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <InternalSignedInAccount className="max-w-[13rem]" />
            {userRole === 'admin' && (
              <button type="button" onClick={() => onNavigate('admin')} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </button>
            )}
            <button type="button" onClick={() => onNavigate('home')} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
              <ExternalLink className="h-4 w-4" />
              Open site
            </button>
            <button type="button" onClick={() => void signOut()} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="joko-admin-content pb-14">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-7">
            <p className="joko-admin-eyebrow">Catalogue maintenance</p>
            <h1 className="joko-admin-title mt-1 text-3xl font-semibold">Products</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#303532]/62">
              Update product content, pricing, images, categories and availability. Product creation, deletion and inventory overrides remain Admin-only.
            </p>
          </div>

          <div className="joko-admin-paper-card p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_260px]">
              <label className="relative block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products…"
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-[#55766F]"
                />
              </label>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#55766F]"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.title_en}</option>
                ))}
              </select>
            </div>
          </div>

          {catalogueError && (
            <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {catalogueError}
            </div>
          )}

          {catalogueLoading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#55766F]" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="joko-admin-paper-card mt-5 flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
              <PackageSearch className="h-9 w-9 text-[#55766F]" />
              <p className="mt-3 font-semibold text-gray-900">No matching products</p>
              <p className="mt-1 text-sm text-gray-500">Try another search or category.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const category = categories.find((item) => item.id === product.category_id);
                return (
                  <article key={product.id} className="joko-admin-paper-card overflow-hidden">
                    <div className="aspect-[4/3] bg-[#EEE8DD]">
                      {product.image ? (
                        <img src={product.image} alt={product.name_en} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400">No image</div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">{category?.title_en || 'Uncategorised'}</p>
                          <h2 className="mt-1 text-lg font-semibold text-gray-900">{product.name_en}</h2>
                          <p className="mt-1 text-sm text-gray-500">{product.name_th}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-gray-900">฿{Number(product.price).toLocaleString()}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-medium ${product.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {product.is_active ? 'Visible' : 'Hidden'}
                        </span>
                        {product.is_sold_out && <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">Sold out</span>}
                        <span className="rounded-full bg-[#F4EFE5] px-2.5 py-1 font-medium text-gray-700">
                          Stock {product.stock_remaining}/{product.stock_total}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing(product)}
                        className="joko-admin-primary-button mt-5 w-full px-4 py-2.5"
                      >
                        Edit product
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {editing && (
        <ProductEditor
          product={editing}
          categories={categories}
          locations={[]}
          mode="product-staff"
          onSave={() => {
            setEditing(null);
            void refreshCatalogue();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ProductStaffLogin() {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await sendEmailOtp(email.trim(), undefined, false, 'product-staff');
      setOtpSent(true);
      setOtp('');
    } catch (err) {
      console.error('Product Staff OTP request failed:', err);
      setError('Could not send a verification code. Use an existing authorized JOKO TODAY account.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await verifyEmailOtp(email.trim(), otp);
    } catch (err) {
      console.error('Product Staff OTP verification failed:', err);
      setError('That verification code is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProductStaffGate>
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#D9ECE9]">
        <PackageSearch className="h-7 w-7 text-[#55766F]" />
      </div>
      <h1 className="joko-admin-title text-center text-2xl font-semibold">JOKO TODAY Product Staff</h1>
      <p className="mt-2 text-center text-sm text-gray-600">Sign in with an authorized Product Staff or Admin account.</p>

      {!otpSent ? (
        <form onSubmit={sendCode} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email</span>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="joko-admin-login-field w-full py-3 pl-10 pr-4" />
            </div>
          </label>
          {error && <GateError error={error} />}
          <button type="submit" disabled={submitting || !email.trim()} className="joko-admin-primary-button flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send verification code
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-6 space-y-4">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Code sent to <strong>{email}</strong></p>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Verification code</span>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="text" inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="joko-admin-login-field w-full py-3 pl-10 pr-4 text-center font-semibold tracking-[0.35em]" />
            </div>
          </label>
          {error && <GateError error={error} />}
          <button type="submit" disabled={submitting || otp.length !== 6} className="joko-admin-primary-button flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify & enter
          </button>
          <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setError(''); }} className="w-full text-sm font-medium text-[#55766F]">
            Use another email
          </button>
        </form>
      )}
    </ProductStaffGate>
  );
}

function ProductStaffGate({ children }: { children: ReactNode }) {
  const { logoUrl, brandingStyle } = useInternalJokoBranding();

  return (
    <div className="joko-admin-shell flex min-h-screen items-center justify-center px-4 py-10" style={brandingStyle}>
      <div className="w-full max-w-md">
        <div className="joko-admin-paper-card p-7 sm:p-8">
          <img src={logoUrl} alt="JOKO TODAY" className="joko-admin-brand-logo mb-6" />
          {children}
        </div>
      </div>
    </div>
  );
}

function GateStatus({ message }: { message: string }) {
  return <div className="flex items-center justify-center gap-3 py-5 text-sm font-medium text-gray-700"><Loader2 className="h-5 w-5 animate-spin text-[#55766F]" />{message}</div>;
}

function GateError({ error }: { error: string }) {
  return <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>;
}
