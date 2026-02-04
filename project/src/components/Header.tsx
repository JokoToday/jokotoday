import { ShoppingCart, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { AuthModal } from './AuthModal';
import { UserAvatarDropdown } from './UserAvatarDropdown';

type HeaderProps = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const { totalItems, setIsCartOpen } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { getLabel } = useCMSLabels();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const navItems = [
    { label: t.nav.home, value: 'home' },
    { label: t.nav.products, value: 'products' },
    { label: t.nav.howItWorks, value: 'how-it-works' },
    { label: t.nav.about, value: 'about' },
  ];

  return (
    <header className="bg-primary-50 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-2 group"
          >
            <div className="text-2xl font-header font-bold text-primary-900 group-hover:text-primary-700 transition-colors">
              JOKO TODAY
            </div>
          </button>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <button
                key={item.value}
                onClick={() => onNavigate(item.value)}
                className={`text-sm font-medium transition-colors ${
                  currentPage === item.value
                    ? 'text-primary-900 border-b-2 border-primary-900'
                    : 'text-primary-700 hover:text-primary-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden md:flex items-center gap-1 bg-primary-100 rounded-lg p-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-700 hover:bg-primary-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('th')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'th'
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-700 hover:bg-primary-200'
                }`}
              >
                TH
              </button>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-primary-900 hover:text-primary-700 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {user ? (
              <div className="hidden md:block">
                <UserAvatarDropdown onNavigate={onNavigate} />
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="hidden md:px-4 md:py-2 md:bg-amber-600 md:text-white md:rounded-lg md:text-sm md:font-medium md:hover:bg-amber-700 md:transition-colors md:inline-block"
              >
                {getLabel('nav.signin_signup', language, t.auth.signUpLogIn)}
              </button>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-primary-900"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-primary-200">
            {navItems.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  onNavigate(item.value);
                  setIsMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                  currentPage === item.value
                    ? 'text-primary-900 bg-primary-100'
                    : 'text-primary-700 hover:bg-primary-100'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="px-4 py-3 mt-2 border-t border-primary-200 space-y-3">
              <div className="flex items-center gap-2 bg-primary-100 rounded-lg p-1">
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-primary-700 text-white'
                      : 'text-primary-700 hover:bg-primary-200'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('th')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    language === 'th'
                      ? 'bg-primary-700 text-white'
                      : 'text-primary-700 hover:bg-primary-200'
                  }`}
                >
                  TH
                </button>
              </div>
              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="px-3 py-2 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Signed in as</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      onNavigate('my-qr');
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    {getLabel('nav.my_qr', language, 'My QR Code')}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('orders');
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    {getLabel('nav.my_orders', language, 'My Orders')}
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    {getLabel('nav.my_profile', language, 'My Profile')}
                  </button>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    {getLabel('nav.logout', language, 'Log Out')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsAuthModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  {getLabel('nav.signin_signup', language, t.auth.signUpLogIn)}
                </button>
              )}
            </div>
          </nav>
        )}

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    </header>
  );
}
