import { lazy, Suspense, useState } from 'react';
import { Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import { getPublicImageUrl } from '../../../lib/storage';
import { Container } from '../../../platform/design-system';

const AuthModal = lazy(() => import('../../../components/AuthModal').then(({ AuthModal }) => ({ default: AuthModal })));

type HomepageExperienceHeaderProps = {
  onNavigate: (page: string) => void;
};

type NavItem = {
  key: string;
  label: string;
  target?: string;
  current?: boolean;
};

const copy = {
  en: {
    today: 'Today',
    stories: 'Stories',
    curiosities: 'Curiosities',
    people: 'People',
    bakery: 'Bakery',
    about: 'About',
    account: 'Account',
    cart: 'Cart',
    menu: 'Menu',
  },
  th: {
    today: 'วันนี้',
    stories: 'เรื่องราว',
    curiosities: 'เรื่องน่าสงสัย',
    people: 'ผู้คน',
    bakery: 'เบเกอรี่',
    about: 'เกี่ยวกับเรา',
    account: 'บัญชี',
    cart: 'ตะกร้า',
    menu: 'เมนู',
  },
  zh: {
    today: '今日',
    stories: '故事',
    curiosities: '好奇',
    people: '人物',
    bakery: '烘焙坊',
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

export function HomepageExperienceHeader({ onNavigate }: HomepageExperienceHeaderProps) {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const labels = copy[language];

  const navItems: NavItem[] = [
    { key: 'today', label: labels.today, current: true },
    { key: 'stories', label: labels.stories },
    { key: 'curiosities', label: labels.curiosities },
    { key: 'people', label: labels.people },
    { key: 'bakery', label: labels.bakery, target: 'products' },
    { key: 'about', label: labels.about, target: 'about' },
  ];

  const handleNav = (target?: string) => {
    if (!target) return;
    onNavigate(target);
    setIsMobileMenuOpen(false);
  };

  const handleAccount = () => {
    if (user) {
      onNavigate('profile');
      return;
    }
    setIsAuthModalOpen(true);
  };

  return (
    <>
      <header className="relative z-40 border-b border-primary-900/10 bg-background-secondary">
        <Container width="wide">
          <div className="flex min-h-24 items-center justify-between gap-5 py-4 lg:min-h-28">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="JOKO TODAY home"
            >
              <img
                src={getPublicImageUrl('logos/joko-today-logo.png')}
                alt="JOKO TODAY"
                className="h-14 w-auto object-contain sm:h-16"
              />
            </button>

            <nav className="hidden lg:block" aria-label="JOKO TODAY">
              <ul className="flex items-center gap-7">
                {navItems.map((item) => (
                  <li key={item.key}>
                    {item.current ? (
                      <span
                        className="border-b border-primary-700 pb-1 text-sm font-semibold text-primary-950"
                        aria-current="page"
                      >
                        {item.label}
                      </span>
                    ) : item.target ? (
                      <button
                        type="button"
                        onClick={() => handleNav(item.target)}
                        className="border-b border-transparent pb-1 text-sm font-semibold text-primary-950 transition hover:border-primary-700 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span
                        className="cursor-default text-sm font-semibold text-primary-950/55"
                        aria-disabled="true"
                      >
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
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
                      'rounded-md px-2 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                      language === option.code
                        ? 'bg-background text-primary-950 shadow-sm'
                        : 'text-primary-950/60 hover:text-primary-950',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAccount}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-950 transition hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={labels.account}
              >
                <UserRound className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-950 transition hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={labels.cart}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-950 transition hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 lg:hidden"
                aria-label={labels.menu}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="border-t border-primary-900/10 pb-5 pt-4 lg:hidden">
              <nav aria-label="JOKO TODAY mobile">
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {navItems.map((item) => (
                    <li key={item.key}>
                      {item.current ? (
                        <span
                          className="block w-full rounded-lg bg-background/70 px-3 py-2 text-left text-sm font-semibold text-primary-950"
                          aria-current="page"
                        >
                          {item.label}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleNav(item.target)}
                          disabled={!item.target}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary-950 transition hover:bg-background/70 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-default disabled:text-primary-950/45"
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-4 flex items-center gap-2 border-t border-primary-900/10 pt-4 md:hidden">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguage(option.code)}
                    aria-pressed={language === option.code}
                    className={[
                      'rounded-md px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      language === option.code
                        ? 'bg-background text-primary-950 shadow-sm'
                        : 'text-primary-950/60',
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

export default HomepageExperienceHeader;
