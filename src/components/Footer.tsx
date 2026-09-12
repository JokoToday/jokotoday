import { pickupLocations } from '../data/locations';
import {
  ExternalLink,
  Settings,
  Facebook,
  MapPin,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Globe,
  Phone,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSocialLinks } from '../hooks/useSocialLinks';

const getSocialIcon = (iconKey: string) => {
  const iconClass = 'w-5 h-5';
  switch (iconKey) {
    case 'facebook': return <Facebook className={iconClass} />;
    case 'map-pin':
    case 'google':
    case 'google_maps': return <MapPin className={iconClass} />;
    case 'twitter':
    case 'x': return <Twitter className={iconClass} />;
    case 'instagram': return <Instagram className={iconClass} />;
    case 'youtube': return <Youtube className={iconClass} />;
    case 'linkedin': return <Linkedin className={iconClass} />;
    default: return <Globe className={iconClass} />;
  }
};

type FooterProps = {
  onNavigate?: (page: string) => void;
  variant?: 'default' | 'mineral';
};

export default function Footer({ onNavigate, variant = 'default' }: FooterProps) {
  const { language, t } = useLanguage();
  const { socialLinks } = useSocialLinks();
  const mineral = variant === 'mineral';

  const getLocationName = (id: string) => id === 'mae-rim' ? t.location.maeRimName : t.location.inTownName;
  const getLocationDays = (id: string) => id === 'mae-rim' ? t.location.maeRimDays : t.location.inTownDays;

  const handleAdminClick = () => onNavigate ? onNavigate('admin') : (window.location.hash = '#admin');
  const handleStaffClick = () => onNavigate ? onNavigate('staff') : (window.location.href = '/staff');

  const staffLabel = language === 'th'
    ? 'เข้าสู่ระบบพนักงาน'
    : language === 'zh'
      ? '员工登录'
      : 'Staff Login';

  const footerClass = mineral
    ? 'mt-auto bg-[#466861] text-[#F4EFE5]'
    : 'mt-auto bg-primary-900 text-primary-50';
  const mutedClass = mineral ? 'text-[#E2EEE9]' : 'text-primary-100';
  const linkClass = mineral
    ? 'text-[#F4EFE5]/80 hover:text-white'
    : 'text-primary-200 hover:text-primary-50';
  const dividerClass = mineral ? 'border-[#DCE9EC]/25' : 'border-primary-800';

  return (
    <footer className={footerClass}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            {mineral ? (
              <img
                src="/assets/brand/joko-today-logo-v0.4.webp"
                alt="JOKO TODAY"
                className="mb-4 h-12 w-auto object-contain mix-blend-multiply"
              />
            ) : (
              <h3 className="mb-4 text-xl font-header font-bold">JOKO TODAY</h3>
            )}
            <p className={`${mutedClass} text-sm leading-relaxed`}>
              {t.footer.description}
            </p>
            {mineral && (
              <p className="mt-4 text-sm italic text-[#F4EFE5]/75">Life is worth noticing.</p>
            )}
          </div>

          <div>
            <h4 className="mb-4 font-semibold">{t.footer.pickupLocations}</h4>
            <div className={`space-y-4 text-sm ${mutedClass}`}>
              {pickupLocations.map((location) => (
                <div key={location.id}>
                  <p className="font-medium text-current">{getLocationName(location.id)}</p>
                  <p className="mb-2 text-xs">{t.location.open}: {getLocationDays(location.id)}</p>
                  <a
                    href={location.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs transition-colors ${linkClass}`}
                  >
                    <span>{t.location.viewOnMaps}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">{t.footer.contact}</h4>
            <div className={`space-y-2 text-sm ${mutedClass}`}>
              <p>{t.footer.contactLocation}</p>
              <p>{t.footer.preOrdersOnly}</p>
              <div className="mt-3 flex flex-col gap-1.5">
                <a href="tel:0998929264" className={`inline-flex items-center gap-2 transition-colors ${linkClass}`}>
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>099-892 9264</span>
                </a>
                <a href="tel:0659196689" className={`inline-flex items-center gap-2 transition-colors ${linkClass}`}>
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>065-919 6689</span>
                </a>
              </div>
              <p className={`mt-3 text-xs ${mineral ? 'text-[#F4EFE5]/70' : 'text-primary-200'}`}>
                {t.footer.paymentInfo}
              </p>
            </div>
          </div>
        </div>

        <div className={`mt-8 border-t pt-8 ${dividerClass}`}>
          <div className={`flex flex-col items-center justify-between gap-4 text-sm md:flex-row ${mineral ? 'text-[#F4EFE5]/70' : 'text-primary-200'}`}>
            <p>&copy; {new Date().getFullYear()} {t.footer.copyright}</p>

            {socialLinks.length > 0 && (
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-full p-2 transition-all duration-200 hover:-translate-y-0.5 ${mineral ? 'text-[#F4EFE5]/75 hover:bg-white/10 hover:text-white' : 'text-primary-300 hover:bg-primary-800 hover:text-primary-50'}`}
                    aria-label={social.label}
                    title={social.label}
                  >
                    {getSocialIcon(social.icon)}
                  </a>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleStaffClick}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${mineral ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-primary-800 hover:text-primary-50'}`}
              >
                <Lock className="h-4 w-4" />
                {staffLabel}
              </button>
              <button
                onClick={handleAdminClick}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${mineral ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-primary-800 hover:text-primary-50'}`}
              >
                <Settings className="h-4 w-4" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
