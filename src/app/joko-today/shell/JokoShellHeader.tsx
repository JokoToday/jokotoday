import { lazy, Suspense, useEffect, useState } from 'react';
import { Menu, ShoppingCart, UserRound, X, Home, ShoppingBasket, Compass, ChevronDown, Croissant, Package, Users, Tag, CookingPot, Signpost, Building2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { useLanguage } from '../../../context/LanguageContext';
import { UserAvatarDropdown } from '../../../components/UserAvatarDropdown';
import { Container } from '../../../platform/design-system';
import { DEFAULT_JOKO_LOGO_URL, usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import { getTopMenuLabel, resolveTopMenu } from '../../../platform/builder';
import './jokoNavPencil.css';

const AuthModal = lazy(() => import('../../../components/AuthModal').then(({ AuthModal }) => ({ default: AuthModal })));

export type JokoShellSection = 'today' | 'curiosities' | 'makers' | 'bakery' | 'about' | 'gallery' | 'what-people-say';

type JokoShellHeaderProps = {
  onNavigate: (page: string) => void;
  activeSection?: JokoShellSection | null;
};

type NavItem = {
  key: 'home' | 'products' | 'other-products' | 'store' | 'specials' | 'makers' | 'how-it-works' | 'pickup' | 'about' | 'diy';
  label: string;
  page?: string;
  targetId?: string;
  activeKey?: JokoShellSection;
  description?: string;
  href?: string;
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
  const [openGroup, setOpenGroup] = useState<'shopping' | 'explore' | null>(null);
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
    makers: { page: 'makers', activeKey: 'makers' },
    'other-products': { page: 'products-non-bakery', activeKey: 'bakery' },
    store: { page: 'store' },
    specials: { page: 'specials' },
    'how-it-works': { targetId: 'how-it-works' },
    pickup: { targetId: 'pickup' },
    about: { targetId: 'about', activeKey: 'about' },
    diy: { page: 'diy' },
  };
  const navItems: NavItem[] = resolveTopMenu(branding.topMenu)
    .filter((item) => item.visible)
    .map((item) => ({ key: item.key, label: getTopMenuLabel(item, language), description: item.descriptions?.[language], href: item.href, ...targets[item.key] }));

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
    setOpenGroup(null);
    if (item.href) {
      window.location.assign(item.href);
      setIsMobileMenuOpen(false);
      return;
    }
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
    if (item.key === 'makers') return path === '/makers' || path.startsWith('/makers/');
    // The two product menus share /products but differ by query-controlled filter.
    if (item.key === 'other-products') return path === '/products' && selectedCategory === 'non-bakery';
    if (item.key === 'store') return path === '/store';
    if (item.key === 'specials') return path === '/specials';
    if (item.key === 'products') return path === '/products' && selectedCategory === 'bakery';
    if (path === '/' && item.targetId) return activeHash === `#${item.targetId}`;
    // The founder and full-story pages belong to About, but the indicator must
    // disappear when the customer navigates back to the homepage.
    return item.key === 'about' && activeSection === 'about';
  };

  return (
    <>
      <header className={`sticky top-0 z-40 bg-[#CFE3DF]/95 backdrop-blur-md ${activeSection === 'today' ? '' : 'border-b border-[#55766F]/15'}`}>
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

            <nav className="hidden min-[1180px]:flex items-center gap-3 xl:gap-6" aria-label="JOKO TODAY">
              {navItems.filter((item) => item.key === 'home').map((item) => (
                <button key={item.key} type="button" onClick={() => handleNav(item)}
                  className="joko-nav-pencil flex items-center gap-2 px-3 py-2 font-semibold text-[#303532]">
                  <Home size={19} />{item.label}
                </button>
              ))}
              {(['shopping', 'explore'] as const).map((group) => {
                const groupItems = navItems.filter((item) => (group === 'shopping'
                  ? ['products', 'other-products', 'makers', 'specials']
                  : ['diy', 'how-it-works', 'about']).includes(item.key));
                const iconMap = { products: Croissant, 'other-products': Package, makers: Users, specials: Tag,
                  diy: CookingPot, 'how-it-works': Signpost, about: Building2 } as const;
                const descriptions: Record<string, Record<string, string>> = {
                  products: { en: 'Pre-order our bakery favourites', th: 'สั่งขนมอบล่วงหน้า', zh: '预订我们的烘焙精选' },
                  'other-products': { en: 'Ingredients and special finds', th: 'วัตถุดิบและของดี', zh: '食材与精选好物' },
                  makers: { en: 'Discover independent creators', th: 'พบผู้สร้างสรรค์อิสระ', zh: '发现独立创作者' },
                  specials: { en: 'Limited-time offers', th: 'ข้อเสนอพิเศษจำกัดเวลา', zh: '限时优惠' },
                  diy: { en: 'Recipes, videos and baking ideas', th: 'สูตรอาหาร วิดีโอ และไอเดีย', zh: '食谱、视频与烘焙创意' },
                  'how-it-works': { en: 'Ordering, pickup and more', th: 'การสั่งซื้อและรับสินค้า', zh: '订购、取货与更多' },
                  about: { en: 'Our story, community and gallery', th: 'เรื่องราวและภาพของเรา', zh: '我们的故事与图库' },
                };
                return <div key={group} className="relative" onMouseEnter={() => setOpenGroup(group)}
                  onMouseLeave={() => setOpenGroup(null)}>
                  <button type="button" aria-expanded={openGroup === group} aria-haspopup="true"
                    onClick={() => setOpenGroup(openGroup === group ? null : group)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 font-semibold text-[#303532] transition hover:bg-[#F4EFE5]/80 ${openGroup === group ? 'bg-[#F4EFE5]/80' : ''}`}>
                    {group === 'shopping' ? <ShoppingBasket size={20} /> : <Compass size={20} />}
                    {group === 'shopping' ? ({ en: 'Shopping', th: 'ช้อปปิ้ง', zh: '购物' }[language])
                      : ({ en: 'Explore', th: 'สำรวจ', zh: '探索' }[language])}
                    <ChevronDown size={16} className={openGroup === group ? 'rotate-180' : ''} />
                  </button>
                  {openGroup === group && <div className="absolute left-0 top-full z-50 w-[345px] rounded-2xl border border-[#55766F]/15 bg-[#FFFCF6] p-5 shadow-xl">
                    <p className="mb-3 inline-block border-b-2 border-[#DC612A] pb-1 font-semibold italic text-xl text-[#303532]">
                      {group === 'shopping' ? 'Shopping' : 'Explore'}
                    </p>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
                        const Icon = iconMap[item.key as keyof typeof iconMap];
                        return <button key={item.key} type="button" onClick={() => { handleNav(item); setOpenGroup(null); }}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#F1E9DE] focus-visible:outline-2 focus-visible:outline-[#55766F]">
                          <Icon className="shrink-0 text-[#C76624]" size={31} strokeWidth={1.6} />
                          <span className="min-w-0 flex-1"><span className="block font-semibold text-sm text-[#303532]">{item.label}</span>
                            <span className="block text-xs text-[#303532]/65">{item.description || descriptions[item.key]?.[language] || ''}</span></span>
                            <span aria-hidden="true">›</span>
                        </button>;
                      })}
                    </div>
                  </div>}
                </div>;
              })}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              {import.meta.env.VITE_JOKO_ASSISTANT_ENABLED === 'true' && !/^\/(checkout|admin|my-|staff|pickup|walk-in)/.test(window.location.pathname) && (
                <button type="button" data-joko-ask-launcher onClick={() => window.dispatchEvent(new Event('joko-ask-open'))}
                  aria-label="Ask JOKO" title="Ask JOKO"
                  className="group inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[#A44F1D]/30 bg-[#F4EFE5]/90 p-1.5 text-[#8B471F] shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55766F] sm:pr-3">
                  <img src="/assets/assistant/ask-joko-avatar-v1.webp" alt="" width="36" height="36" decoding="async" className="h-9 w-9 shrink-0 rounded-full border border-[#55766F]/20 object-cover" />
                  <span aria-hidden="true" className="hidden whitespace-nowrap text-sm font-semibold sm:inline">Ask JOKO</span>
                </button>
              )}
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
                <p className="mb-2 font-semibold">Shopping</p>
                <ul className="grid grid-cols-2 gap-2">
                  {navItems.filter((item) => ['products','other-products','makers','specials'].includes(item.key)).map((item) => {
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
                <p className="mt-4 mb-2 font-semibold">Explore</p><div className="grid grid-cols-2 gap-2">{navItems.filter((item) => ["diy","how-it-works","about"].includes(item.key)).map((item) => <button key={item.key} type="button" onClick={() => handleNav(item)} className="rounded-lg bg-[#FFFCF6] px-3 py-3 text-left">{item.label}</button>)}</div>

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
