import { ShoppingCart, Calendar, MapPin, CreditCard, Clock } from 'lucide-react';
import LocationMap from '../components/LocationMap';
import { CutoffRulesSelector } from '../components/CutoffRulesSelector';
import { CutoffTimesDisplay } from '../components/CutoffTimesDisplay';
import { pickupLocations } from '../data/locations';
import { useLanguage } from '../context/LanguageContext';

type HowItWorksPageProps = {
  onNavigate: (page: string) => void;
};

export default function HowItWorksPage({ onNavigate }: HowItWorksPageProps) {
  const { t, language } = useLanguage();

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
              <div className="grid md:grid-cols-2 gap-6">
                {pickupLocations.map((location) => (
                  <div key={location.id} className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                    <LocationMap location={location} />
                  </div>
                ))}
              </div>
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
                    {language === 'th' ? 'เวลาปิดรับออเดอร์' : 'Cut-Off Times'}
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
