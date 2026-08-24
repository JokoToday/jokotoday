import { useEffect, useState } from 'react';
import { ShoppingCart, Calendar, MapPin, CreditCard, Clock, Navigation } from 'lucide-react';
import { CutoffTimesDisplay } from '../components/CutoffTimesDisplay';
import { useLanguage } from '../context/LanguageContext';
import { CMSPickupLocation, getPickupLocations } from '../lib/cmsService';
import { getPickupDayLabel, getPickupDays, PickupDay } from '../lib/availabilityService';

type HowItWorksPageProps = {
  onNavigate: (page: string) => void;
};

export default function HowItWorksPage({ onNavigate }: HowItWorksPageProps) {
  const { t, language } = useLanguage();
  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);

  useEffect(() => {
    Promise.all([getPickupLocations(), getPickupDays()])
      .then(([locationData, dayData]) => {
        setLocations(locationData);
        setPickupDays(dayData);
      })
      .catch((error) => {
        console.error('Error loading pickup configuration:', error);
      });
  }, []);

  const steps = [
    {
      icon: ShoppingCart,
      title: t.howItWorks.step1Title,
      description: t.howItWorks.step1Text,
    },
    {
      icon: Calendar,
      title: t.howItWorks.step2Title,
      description: t.howItWorks.step2Text,
    },
    {
      icon: MapPin,
      title: t.howItWorks.step3Title,
      description: t.howItWorks.step3Text,
    },
    {
      icon: CreditCard,
      title: t.howItWorks.step4Title,
      description: t.howItWorks.step4Text,
    },
  ];

  const getLocationName = (location: CMSPickupLocation) => {
    if (language === 'th') return location.name_th || location.name_en;
    if (language === 'zh') return location.name_zh || location.name_en;
    return location.name_en;
  };

  const getLocationDescription = (location: CMSPickupLocation) => {
    if (language === 'th') return location.description_th || location.description_en;
    if (language === 'zh') return location.description_zh || location.description_en;
    return location.description_en;
  };

  const getLocationPickupDays = (locationId: string) =>
    pickupDays
      .filter((day) => day.location_id === locationId && day.is_open)
      .map((day) => getPickupDayLabel(day, language));

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-header font-bold text-primary-900 mb-4">
            {t.howItWorks.title}
          </h1>
          <p className="text-lg text-gray-700">
            {t.howItWorks.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="bg-background rounded-xl shadow-md p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                      <Icon className="h-7 w-7 text-primary-700" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="text-3xl font-bold text-primary-900 mr-3">
                        {index + 1}
                      </span>
                      <h3 className="text-xl font-semibold text-primary-900">{step.title}</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-background rounded-2xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-2xl md:text-3xl font-header font-bold text-primary-900 mb-6">
            {t.howItWorks.orderingTitle}
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-primary-900 mb-4">
                {t.howItWorks.locationsTitle}
              </h3>
              {locations.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {locations.map((location) => {
                    const days = getLocationPickupDays(location.id);
                    const description = getLocationDescription(location);
                    return (
                      <div key={location.id} className="bg-primary-50 rounded-lg p-5 border border-primary-200">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-5 w-5 text-amber-700" />
                          <h4 className="text-lg font-semibold text-amber-900">{getLocationName(location)}</h4>
                        </div>
                        {description && <p className="text-sm text-gray-600 mb-2">{description}</p>}
                        {days.length > 0 && (
                          <p className="text-sm text-amber-700 font-medium mb-4">
                            {t.location.open}: {days.join(', ')}
                          </p>
                        )}
                        {location.maps_url && (
                          <a
                            href={location.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-md"
                          >
                            <Navigation className="h-5 w-5" />
                            <span>{t.location.getDirections}</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {language === 'th' ? 'ยังไม่มีจุดรับสินค้าที่เปิดใช้งาน' : language === 'zh' ? '目前没有已启用的取货地点。' : 'No pickup locations are currently active.'}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-primary-900 mb-2">{t.howItWorks.paymentTitle}</h3>
              <div className="bg-primary-50 rounded-lg p-4 text-gray-700">
                <p>{t.howItWorks.paymentText}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-primary-900 mb-4">
                {t.howItWorks.preOrder}
              </h3>
              <div className="bg-primary-50 rounded-lg p-4 text-gray-700 mb-6">
                <p>{t.howItWorks.preOrderText}</p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <h4 className="font-semibold text-gray-900">
                    {language === 'th' ? 'เวลาปิดรับออเดอร์' : language === 'zh' ? '截止时间' : 'Cut-Off Times'}
                  </h4>
                </div>
                <CutoffTimesDisplay language={language} />
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => onNavigate('products')}
            className="bg-primary-600 text-white px-10 py-4 rounded-lg font-bold text-lg hover:bg-primary-700 transition-colors shadow-md"
          >
            {t.howItWorks.startOrdering}
          </button>
        </div>
      </div>
    </div>
  );
}
