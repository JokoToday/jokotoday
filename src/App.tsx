import { lazy, Suspense, useEffect, useState } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { LikesProvider } from './context/LikesContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import { HomepageRendererGate } from './app/joko-today/builder/HomepageRendererGate';

const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutRouterPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })));
const LineCallback = lazy(() => import('./components/LineCallback').then(({ LineCallback }) => ({ default: LineCallback })));
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage').then(({ CustomerAccountPage }) => ({ default: CustomerAccountPage })));
const StaffScannerPage = lazy(() => import('./pages/StaffScannerPage').then(({ StaffScannerPage }) => ({ default: StaffScannerPage })));
const StaffLoginPage = lazy(() => import('./pages/StaffLoginPage').then(({ StaffLoginPage }) => ({ default: StaffLoginPage })));
const PickupDeskPage = lazy(() => import('./pages/PickupDeskPage').then(({ PickupDeskPage }) => ({ default: PickupDeskPage })));
const WalkInDeskPage = lazy(() => import('./pages/WalkInDeskPage').then(({ WalkInDeskPage }) => ({ default: WalkInDeskPage })));
const MyQRPage = lazy(() => import('./pages/MyQRPage').then(({ MyQRPage }) => ({ default: MyQRPage })));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage').then(({ MyProfilePage }) => ({ default: MyProfilePage })));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage').then(({ MyOrdersPage }) => ({ default: MyOrdersPage })));
const MyLikesPage = lazy(() => import('./pages/MyLikesPage').then(({ MyLikesPage }) => ({ default: MyLikesPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then(({ ScanPage }) => ({ default: ScanPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then(({ AuthCallbackPage }) => ({ default: AuthCallbackPage })));
const QRResolverPage = lazy(() => import('./pages/QRResolverPage'));

const PRIMARY_PAGE_PATHS: Record<string, string> = {
  home: '/',
  products: '/products',
  checkout: '/checkout',
  about: '/about',
  'how-it-works': '/how-it-works',
};

const PRIMARY_PATH_PAGES: Record<string, string> = Object.fromEntries(
  Object.entries(PRIMARY_PAGE_PATHS).map(([page, path]) => [path, page]),
);

const ACCOUNT_PAGE_PATHS: Record<string, string> = {
  profile: '/my-profile',
  orders: '/my-orders',
  'my-qr': '/my-qr',
  favorites: '/my-likes',
};

const ACCOUNT_PATH_PAGES: Record<string, string> = Object.fromEntries(
  Object.entries(ACCOUNT_PAGE_PATHS).map(([page, path]) => [path, page]),
);

const STANDALONE_PAGE_PATHS: Record<string, string> = {
  admin: '/admin',
  staff: '/staff',
  pickup: '/pickup',
  'walk-in': '/walk-in',
};

const STANDALONE_PATH_PAGES: Record<string, string> = Object.fromEntries(
  Object.entries(STANDALONE_PAGE_PATHS).map(([page, path]) => [path, page]),
);

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [qrSource, setQrSource] = useState<string | null>(null);

  useEffect(() => {
    const syncPageFromLocation = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const qrCustomerMatch = path.match(/^\/c\/([^/]+)$/);
      const qrResolverMatch = path.match(/^\/q\/([^/]+)$/);
      const scanMatch = path.match(/^\/scan\/([A-Za-z0-9]+)$/);
      const productMatch = path.match(/^\/product\/([^/]+)$/);

      if (path === '/auth/callback') {
        setCurrentPage('auth-callback');
        return;
      }

      if (scanMatch) {
        setCurrentPage('scan');
        return;
      }

      if (productMatch) {
        const slug = productMatch[1];
        const source = params.get('source');
        setProductSlug(slug);
        if (source) setQrSource(source);
        setCurrentPage('products');
        window.history.replaceState({}, '', '/products');
        return;
      }

      if (qrResolverMatch) {
        setQrToken(qrResolverMatch[1]);
        setCurrentPage('qr-resolve');
        return;
      }

      if (qrCustomerMatch) {
        setQrToken(qrCustomerMatch[1]);
        setCurrentPage('customer-account');
        return;
      }

      if (params.has('line_user_id') && params.has('code')) {
        setCurrentPage('line-callback');
        return;
      }

      if (params.has('code')) {
        const code = params.get('code');
        if (code) {
          const isAuthCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
          if (isAuthCode) {
            setCurrentPage('auth-callback');
          } else {
            setQrToken(code);
            setCurrentPage('customer-account');
          }
          return;
        }
      }

      if (path === '/admin' || path.startsWith('/admin/')) {
        setCurrentPage('admin');
        return;
      }

      const primaryPage = PRIMARY_PATH_PAGES[path];
      if (primaryPage) {
        setCurrentPage(primaryPage);
        return;
      }

      const accountPage = ACCOUNT_PATH_PAGES[path];
      if (accountPage) {
        setCurrentPage(accountPage);
        return;
      }

      const standalonePage = STANDALONE_PATH_PAGES[path];
      if (standalonePage) {
        setCurrentPage(standalonePage);
        return;
      }

      if (path === '/') setCurrentPage('home');
    };

    syncPageFromLocation();
    window.addEventListener('popstate', syncPageFromLocation);

    return () => {
      window.removeEventListener('popstate', syncPageFromLocation);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    const pageTitle = currentPage === 'home'
      ? 'JOKO TODAY - Baked & Beyond'
      : `${currentPage.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} - JOKO TODAY`;
    document.title = pageTitle;
  }, [currentPage]);

  const handleNavigate = (page: string) => {
    const productNavMatch = page.match(/^product\/(.+)$/);
    if (productNavMatch) {
      setProductSlug(productNavMatch[1]);
      if (window.location.pathname !== '/products') {
        window.history.pushState({}, '', '/products');
      }
      setCurrentPage('products');
      return;
    }

    const targetPath = PRIMARY_PAGE_PATHS[page]
      || ACCOUNT_PAGE_PATHS[page]
      || STANDALONE_PAGE_PATHS[page]
      || null;

    if (targetPath && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }

    setCurrentPage(page);
  };

  const renderPage = () => {
    if (currentPage === 'auth-callback') {
      return <AuthCallbackPage onNavigate={handleNavigate} />;
    }

    if (currentPage === 'line-callback') {
      return <LineCallback onNavigate={handleNavigate} />;
    }

    if (currentPage === 'qr-resolve' && qrToken) {
      return <QRResolverPage qrToken={qrToken} />;
    }

    if (currentPage === 'customer-account' && qrToken) {
      return <CustomerAccountPage qrToken={qrToken} onNavigate={handleNavigate} />;
    }

    switch (currentPage) {
      case 'home':
        return <HomepageRendererGate onNavigate={handleNavigate} />;
      case 'products':
        return <ProductsPage initialProductSlug={productSlug} qrSource={qrSource} onProductOpened={() => { setProductSlug(null); setQrSource(null); }} />;
      case 'checkout':
        return <CheckoutPage onNavigate={handleNavigate} />;
      case 'about':
        return <AboutPage />;
      case 'how-it-works':
        return <HowItWorksPage onNavigate={handleNavigate} />;
      case 'admin':
        return <AdminPage onNavigate={handleNavigate} />;
      case 'staff':
        return <StaffLoginPage onNavigate={handleNavigate} />;
      case 'staff-scanner':
        return <StaffScannerPage />;
      case 'pickup':
        return <PickupDeskPage onNavigate={handleNavigate} />;
      case 'walk-in':
        return <WalkInDeskPage onNavigate={handleNavigate} />;
      case 'my-qr':
        return <MyQRPage onNavigate={handleNavigate} />;
      case 'profile':
        return <MyProfilePage onNavigate={handleNavigate} />;
      case 'orders':
        return <MyOrdersPage onNavigate={handleNavigate} />;
      case 'favorites':
        return <MyLikesPage onNavigate={handleNavigate} />;
      case 'scan':
        return <ScanPage />;
      default:
        return <HomepageRendererGate onNavigate={handleNavigate} />;
    }
  };

  const isStandalonePage =
    currentPage === 'customer-account' ||
    currentPage === 'admin' ||
    currentPage === 'staff' ||
    currentPage === 'staff-scanner' ||
    currentPage === 'pickup' ||
    currentPage === 'walk-in' ||
    currentPage === 'scan' ||
    currentPage === 'auth-callback' ||
    currentPage === 'qr-resolve';

  return (
    <div className="min-h-screen flex flex-col">
      {!isStandalonePage && <Header currentPage={currentPage} onNavigate={handleNavigate} />}
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          {renderPage()}
        </Suspense>
      </main>
      {!isStandalonePage && <Footer onNavigate={handleNavigate} />}
      {!isStandalonePage && (
        <CartSidebar
          onCheckout={() => handleNavigate('checkout')}
          onStartShopping={() => handleNavigate('products')}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LikesProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </LikesProvider>
    </AuthProvider>
  );
}

export default App;
