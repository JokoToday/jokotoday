import { lazy, Suspense, useEffect, useState } from 'react';
import { Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import { UserAvatarDropdown } from '../../../components/UserAvatarDropdown';
import { Container } from '../../../platform/design-system';
import { DEFAULT_JOKO_LOGO_URL, usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import { getTopMenuLabel, resolveTopMenu } from '../../../platform/builder';
import './jokoNavPencil.css';

const AuthModal = lazy(() => import('../../../components/AuthModal').then(({ AuthModal }) => ({ default: AuthModal })));

export type JokoShellSection = 'today' | 'curiosities' | 'bakery' | 'about' | 'gallery' | 'what-people-say';

type JokoShellHeaderProps = {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
};

type NavItem = {
  key: 'home' | 'products' | 'other-products' | 'how-it-works' | 'pickup' | 'about';
  label: string;
  page?: string;
  targetId?: string;
  activeKey?: JokoShellSection;
};

const copy = {
  en: {
    home: 'Home',
    products: 'Baked',
    otherProducts: 'Beyond',
    howItWorks: 'How It Works',
    pickup: 'Pick Up',
    about: 'About',
    account: 'Account',
    cart: 'Cart',
    menu: 'Menu',
  },
  th: {
    home: 'หน้าแรก',
    products: 'ขนมอบ',
    otherProducts: 'ของดีอื่น ๆ',
    howItWorks: 'วิธีสั่งซื้อ',
    pickup: 'จุดรับสินค้า',
    about: 'เกี่ยวกับเรา',
    account: 'บัญชี',
    cart: 'ตะกร้า',
    menu: 'เมนู',
  },
  zh: {
    home: '首页',
    products: '烘焙好物',
    otherProducts: '其他好物',
    howItWorks: '如何订购',
    pickup: '取货',
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
  const { totalItems, setIsCartOpen, selectedCategory } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // pushState does not emit popstate. Keep section selection synchronized with
  // programmatic navigation, Home/Back to home, and browser back/forward.
  const [activeHash, setActiveHash] = useState(() =>
    window.location.pathname === '/' ? window.location.hash : '',
  );
  useEffect(() => {
    const syncLocation = () => setActiveHash(
      window.location.pathname === '/' ? window.location.hash : '',
    );
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('joko-navigation-updated', syncLocation);
    syncLocation();
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('joko-navigation-updated', syncLocation);
    };
  }, [activeSection]);
  const labels = copy[language];
  const { logoUrl, branding } = usePublishedJokoBranding();
  // Public Header and mobile drawer resolve the exact same published menu.
  // Routes remain code-defined; admins may change labels, visibility or order.
  const targets: Record<NavItem['key'], Omit<NavItem, 'key' | 'label'>> = {
    home: { targetId: 'top', activeKey: 'today' },
    products: { page: 'products-bakery', activeKey: 'bakery' },
    'other-products': { page: 'products-non-bakery', activeKey: 'bakery' },
    'how-it-works': { targetId: 'how-it-works' },
    pickup: { targetId: 'pickup' },
    about: { targetId: 'about', activeKey: 'about' },
  };
  const navItems: NavItem[] = resolveTopMenu(branding.topMenu)
    .filter((item) => item.visible)
    .map((item) => ({ key: item.key, label: getTopMenuLabel(item, language), ...targets[item.key] }));

  const handleHomeSection = (targetId: string) => {
    const isTop = targetId === 'top';
    const targetPath = isTop ? '/' : `/#${targetId}`;

    const scrollToTarget = () => {
      if (isTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const pushSectionStateAndScroll = () => {
      const currentPath = `${window.location.pathname}${window.location.hash}`;
      if (currentPath !== targetPath) {
        window.history.pushState({ jokoHomepageSection: isTop ? null : targetId }, '', targetPath);
      }
      setActiveHash(isTop ? '' : `#${targetId}`);
      window.dispatchEvent(new Event('joko-navigation-updated'));
      scrollToTarget();
    };

    if (window.location.pathname !== '/') {
      onNavigate('home');
      window.setTimeout(pushSectionStateAndScroll, 80);
    } else {
      pushSectionStateAndScroll();
    }
    setIsMobileMenuOpen(false);
  };

  const handleNav = (item: NavItem) => {
    if (item.targetId) {
      handleHomeSection(item.targetId);
      return;
    }
    if (item.page) onNavigate(item.page);
    setIsMobileMenuOpen(false);
  };

  const handleAccount = () => {
    setIsMobileMenuOpen(false);
    setIsAuthModalOpen(true);
  };

  const isNavItemActive = (item: NavItem) => {
    const path = window.location.pathname;
    // Home is intentionally not permanently marked; a stroke appears on hover.
    if (item.key === 'home') return false;
    // The two product menus share /products but differ by query-controlled filter.
    if (item.key === 'other-products') return path === '/products' && selectedCategory === 'non-bakery';
    if (item.key === 'products') return path === '/products' && selectedCategory === 'bakery';
    if (path === '/' && item.targetId) return activeHash === `#${item.targetId}`;
    // The founder and full-story pages belong to About, but the indicator must
    // disappear when the customer navigates back to the homepage.
    return item.key === 'about' && activeSection === 'about';
  };

  return (
    <>
      <header className={`relative z-40 bg-[#CFE3DF] ${activeSection === 'today' ? '' : 'border-b border-[#55766F]/15'}`}>
        <Container width="wide">
          <div className="flex min-h-20 items-center justify-between gap-5 py-3 lg:min-h-24">
            <button
              type="button"
              onClick={() => handleHomeSection('top')}
              className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#CFE3DF]"
              aria-label="JOKO TODAY home"
            >
              <img
                src={logoUrl}
                alt="JOKO TODAY"
                onError={(event) => {
                  if (event.currentTarget.src.endsWith(DEFAULT_JOKO_LOGO_URL)) return;
                  event.currentTarget.src = DEFAULT_JOKO_LOGO_URL;
                }}
                className="joko-shell-logo w-auto object-contain mix-blend-multiply"
              />
            </button>

            <nav className="hidden min-[1180px]:block" aria-label="JOKO TODAY">
              <ul className="flex items-center gap-4 xl:gap-6">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item);
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => handleNav(item)}
                        aria-current={isActive ? (item.targetId ? 'location' : 'page') : undefined}
                        data-current={isActive ? 'true' : 'false'}
                        className="joko-nav-pencil font-medium text-[#303532]/85 transition hover:text-[#303532]"
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

              {user ? (
                <UserAvatarDropdown onNavigate={onNavigate} />
              ) : (
                <button
                  type="button"
                  onClick={handleAccount}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303532] transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  aria-label={labels.account}
                >
                  <UserRound className="h-5 w-5" />
                </button>
              )}

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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303532] transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-[#55766F] min-[1180px]:hidden"
                aria-label={labels.menu}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="border-t border-[#55766F]/15 pb-5 pt-4 min-[1180px]:hidden">
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
                            'w-full rounded-lg px-3 py-2 text-left text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]',
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
