import { lazy, Suspense, useState } from 'react';
import { Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../../platform/design-system';

const AuthModal = lazy(() => import('../../../components/AuthModal').then(({ AuthModal }) => ({ default: AuthModal })));

export type JokoShellSection = 'today' | 'bakery' | 'about';

type JokoShellHeaderProps = {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
};

type NavItem = {
  key: 'home' | 'products' | 'curiosities' | 'about';
  label: string;
  page?: string;
  notebookPath?: string;
  activeKey?: JokoShellSection;
};

const copy = {
  en: {
    home: 'Home',
    products: 'Products',
    curiosities: 'Curiosities',
    about: 'About',
    account: 'Account',
    cart: 'Cart',
    menu: 'Menu',
  },
  th: {
    home: 'หน้าแรก',
    products: 'สินค้า',
    curiosities: 'ความสงสัย',
    about: 'เกี่ยวกับเรา',
    account: 'บัญชี',
    cart: 'ตะกร้า',
    menu: 'เมนู',
  },
  zh: {
    home: '首页',
    products: '产品',
    curiosities: '好奇',
    about: '关于',
    account: '账户',
    cart: '购物车',
    menu: '菜单',
  },
} as const;

const languageOptions = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'TH' },
  { code: 'zh', label: '中文' },
] as const;

export function JokoShellHeader({ onNavigate, activeSection = null }: JokoShellHeaderProps) {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const labels = copy[language];

  const navItems: NavItem[] = [
    { key: 'home', label: labels.home, page: 'home', activeKey: 'today' },
    { key: 'products', label: labels.products, page: 'products', activeKey: 'bakery' },
    { key: 'curiosities', label: labels.curiosities, notebookPath: '/notebook/today' },
    { key: 'about', label: labels.about, page: 'about', activeKey: 'about' },
  ];

  const handleNotebookPath = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({ jokoNotebook: true }, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setIsMobileMenuOpen(false);
  };

  const handleNav = (item: NavItem) => {
    if (item.notebookPath) {
      handleNotebookPath(item.notebookPath);
      return;
    }
    if (item.page) onNavigate(item.page);
    setIsMobileMenuOpen(false);
  };

  const handleAccount = () => {
    if (user) {
      onNavigate('profile');
      setIsMobileMenuOpen(false);
      return;
    }
    setIsAuthModalOpen(true);
  };

  const isNavItemActive = (item: NavItem) => {
    const path = window.location.pathname;
    if (item.key === 'curiosities') return path.startsWith('/notebook/');
    if (item.key === 'home') return path === '/';
    return item.activeKey ? activeSection === item.activeKey : false;
  };

  return (
    <>
      <header className="relative z-40 border-b border-[#55766F]/15 bg-[#CFE3DF]">
        <Container width="wide">
          <div className="flex min-h-20 items-center justify-between gap-5 py-3 lg:min-h-24">
            <button
              type="button"
              onClick={() => handleNav(navItems[0])}
              className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#CFE3DF]"
              aria-label="JOKO TODAY home"
            >
              <img
                src="/assets/brand/joko-today-logo-v0.4.webp"
                alt="JOKO TODAY"
                className="h-14 w-auto object-contain mix-blend-multiply sm:h-16"
              />
            </button>

            <nav className="hidden lg:block" aria-label="JOKO TODAY">
              <ul className="flex items-center gap-8 xl:gap-10">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item);
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => handleNav(item)}
                        aria-current={isActive ? 'page' : undefined}
                        className={[
                          'border-b pb-1 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#CFE3DF] xl:text-base',
                          isActive
                            ? 'border-[#C76624] text-[#303532]'
                            : 'border-transparent text-[#303532]/85 hover:border-[#C76624]/65 hover:text-[#303532]',
                        ].join(' ')}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-1 md:flex" aria-label="Language">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguage(option.code)}
                    aria-pressed={language === option.code}
                    className={[
                      'rounded-md px-2 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#55766F]',
                      language === option.code
                        ? 'bg-[#F4EFE5]/80 text-[#303532] shadow-sm'
                        : 'text-[#303532]/60 hover:text-[#303532]',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAccount}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303532] transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                aria-label={labels.account}
              >
                <UserRound className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303532] transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                aria-label={labels.cart}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C76624] px-1 text-[10px] font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303532] transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-[#55766F] lg:hidden"
                aria-label={labels.menu}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="border-t border-[#55766F]/15 pb-5 pt-4 lg:hidden">
              <nav aria-label="JOKO TODAY mobile">
                <ul className="grid grid-cols-2 gap-2">
                  {navItems.map((item) => {
                    const isActive = isNavItemActive(item);
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => handleNav(item)}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'w-full rounded-lg px-3 py-2 text-left text-base font-medium transition focus:outline-none focus:ring-2 focus:ring-[#55766F]',
                            isActive ? 'bg-[#F4EFE5]/65 text-[#303532]' : 'text-[#303532] hover:bg-white/20',
                          ].join(' ')}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mt-4 flex items-center gap-2 border-t border-[#55766F]/15 pt-4 md:hidden">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguage(option.code)}
                    aria-pressed={language === option.code}
                    className={[
                      'rounded-md px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#55766F]',
                      language === option.code ? 'bg-[#F4EFE5]/70 text-[#303532] shadow-sm' : 'text-[#303532]/60',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Container>
      </header>

      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default JokoShellHeader;
