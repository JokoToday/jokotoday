import { pickupLocations } from '../data/locations';
import { ExternalLink, Settings, Package } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { language, t } = useLanguage();

  const getLocationName = (id: string) => {
    return id === 'mae-rim' ? t.location.maeRimName : t.location.inTownName;
  };

  const getLocationDays = (id: string) => {
    return id === 'mae-rim' ? t.location.maeRimDays : t.location.inTownDays;
  };

  const handleAdminClick = () => {
    if (onNavigate) {
      onNavigate('admin');
    } else {
      window.location.hash = '#admin';
    }
  };

  const handlePickupDeskClick = () => {
    if (onNavigate) {
      onNavigate('pickup');
    } else {
      window.location.hash = '#pickup';
    }
  };

  const handleWalkInClick = () => {
    if (onNavigate) {
      onNavigate('walk-in');
    } else {
      window.location.hash = '#walk-in';
    }
  };

  return (
    <footer className="bg-primary-900 text-primary-50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-header font-bold mb-4">JOKO TODAY</h3>
            <p className="text-primary-100 text-sm leading-relaxed">
              {t.footer.description}
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.pickupLocations}</h4>
            <div className="space-y-4 text-sm text-primary-100">
              {pickupLocations.map((location) => (
                <div key={location.id}>
                  <p className="font-medium text-primary-50">{getLocationName(location.id)}</p>
                  <p className="text-xs mb-2">{t.location.open}: {getLocationDays(location.id)}</p>
                  <a
                    href={location.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-200 hover:text-primary-50 transition-colors text-xs"
                  >
                    <span>{t.location.viewOnMaps}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t.footer.contact}</h4>
            <div className="space-y-2 text-sm text-primary-100">
              <p>{t.footer.contactLocation}</p>
              <p>{t.footer.preOrdersOnly}</p>
              <p className="text-xs mt-4 text-primary-200">
                {t.footer.paymentInfo}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-primary-800">
          <div className="flex justify-between items-center text-sm text-primary-200">
            <p>&copy; {new Date().getFullYear()} {t.footer.copyright}</p>
            <div className="flex gap-2">
              <button
                onClick={handlePickupDeskClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary-800 transition-colors text-primary-200 hover:text-primary-50"
              >
                <Package className="w-4 h-4" />
                {language === 'en' ? 'Pickup Desk' : 'จุดรับสินค้า'}
              </button>
              <button
                onClick={handleWalkInClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary-800 transition-colors text-primary-200 hover:text-primary-50"
              >
                <Package className="w-4 h-4" />
                {language === 'en' ? 'Walk-In Desk' : 'เคาน์เตอร์ลูกค้า Walk-In'}
              </button>
              <button
                onClick={handleAdminClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary-800 transition-colors text-primary-200 hover:text-primary-50"
              >
                <Settings className="w-4 h-4" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
