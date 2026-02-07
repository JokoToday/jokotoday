import { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
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
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ScanPage } from './pages/ScanPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import QRResolverPage from './pages/QRResolverPage'

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [qrToken, setQrToken] = useState<string | null>(null);

  useEffect(() => {
  const path = window.location.pathname;

  const qrResolveMatch = path.match(/^\/q\/([^/]+)$/);
  const scanMatch = path.match(/^\/scan\/([^/]+)$/);

  if (path === '/auth/callback') {
    setCurrentPage('auth-callback');
    return;
  }

  if (qrResolveMatch) {
    setQrToken(qrResolveMatch[1]);
    setCurrentPage('qr-resolver');
    return;
  }

  if (scanMatch) {
    setQrToken(scanMatch[1]);
    setCurrentPage('qr-resolver');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has('line_user_id') && params.has('code')) {
    setCurrentPage('line-callback');
    return;
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
    setCurrentPage(page);
  };

  const renderPage = () => {
    if (currentPage === 'auth-callback') {
      return <AuthCallbackPage onNavigate={handleNavigate} />;
    }

    if (currentPage === 'line-callback') {
      return <LineCallback onNavigate={handleNavigate} />;
    }
    if (currentPage === 'qr-resolver' && qrToken) {
  return <QRResolverPage qrToken={qrToken} />
}
    if (currentPage === 'customer-account' && qrToken) {
      return <CustomerAccountPage qrToken={qrToken} />;
    }

    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'products':
        return <ProductsPage />;
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
      case 'reset-password':
        return <ResetPasswordPage onNavigate={handleNavigate} />;
           default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  const isStandalonePage = currentPage === 'customer-account' || currentPage === 'staff-scanner' || currentPage === 'pickup' || currentPage === 'walk-in' || currentPage === 'reset-password' || currentPage === 'scan' || currentPage === 'auth-callback';

  return (
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col">
          {!isStandalonePage && <Header currentPage={currentPage} onNavigate={handleNavigate} />}
          <main className="flex-1">{renderPage()}</main>
          {!isStandalonePage && <Footer onNavigate={handleNavigate} />}
          {!isStandalonePage && <CartSidebar onCheckout={() => handleNavigate('checkout')} />}
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
