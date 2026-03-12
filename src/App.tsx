import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LikesProvider } from './context/LikesContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import CheckoutPage from './pages/CheckoutPage';
import AboutPage from './pages/AboutPage';
import HowItWorksPage from './pages/HowItWorksPage';
import { AdminPage } from './pages/AdminPage';
import { LineCallback } from './components/LineCallback';
import { CustomerAccountPage } from './pages/CustomerAccountPage';
import { StaffScannerPage } from './pages/StaffScannerPage';
import { PickupDeskPage } from './pages/PickupDeskPage';
import { WalkInDeskPage } from './pages/WalkInDeskPage';
import { MyQRPage } from './pages/MyQRPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { MyLikesPage } from './pages/MyLikesPage';
import { ScanPage } from './pages/ScanPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import QRResolverPage from './pages/QRResolverPage';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [qrSource, setQrSource] = useState<string | null>(null);
  const { user, loading } = useAuth();

  useEffect(() => {
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
      window.history.replaceState({}, '', '/');
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
      setCurrentPage('products');
      return;
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
        return <HomePage onNavigate={handleNavigate} />;
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
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const isStandalonePage =
    currentPage === 'customer-account' ||
    currentPage === 'staff-scanner' ||
    currentPage === 'pickup' ||
    currentPage === 'walk-in' ||
    currentPage === 'scan' ||
    currentPage === 'auth-callback' ||
    currentPage === 'qr-resolve';

  return (
    <div className="min-h-screen flex flex-col">
      {!isStandalonePage && <Header currentPage={currentPage} onNavigate={handleNavigate} />}
      <main className="flex-1">{renderPage()}</main>
      {!isStandalonePage && <Footer onNavigate={handleNavigate} />}
      {!isStandalonePage && <CartSidebar onCheckout={() => handleNavigate('checkout')} />}

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
