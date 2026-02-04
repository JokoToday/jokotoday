import { useState, useEffect } from 'react';
import { ArrowRight, Cookie, Croissant, Pizza, Wheat } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getImageUrl, getCategories, CMSCategory } from '../lib/cmsService';
import { useCart } from '../context/CartContext';

type HomePageProps = {
  onNavigate: (page: string) => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  const { t, language } = useLanguage();
  const { setSelectedCategory } = useCart();
  const [heroImageUrl, setHeroImageUrl] = useState('/joko_bakery_ghibli_ok.png');
  const [categories, setCategories] = useState<CMSCategory[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const heroUrl = await getImageUrl('hero_image_url', '/joko_bakery_ghibli_ok.png');
      setHeroImageUrl(heroUrl);
      const cmsCategories = await getCategories();
      setCategories(cmsCategories);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    onNavigate('products');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-header font-bold text-primary-900 leading-tight">
                JOKO TODAY
              </h1>
              <p className="text-2xl md:text-3xl text-primary-700 font-medium">
                {t.hero.title}
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                {t.hero.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => onNavigate('products')}
                  className="bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center group"
                >
                  {t.hero.orderButton}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => onNavigate('how-it-works')}
                  className="bg-background text-primary-900 px-8 py-4 rounded-lg font-semibold border-2 border-primary-600 hover:bg-primary-50 transition-colors"
                >
                  {t.nav.howItWorks}
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-full overflow-hidden shadow-2xl">
                <img
                  src={heroImageUrl}
                  alt="JOKO Bakery"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-header font-bold text-center text-primary-900 mb-12">
            {t.whatWeBake.title}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories.map((category) => {
              const categoryName = language === 'th' ? category.title_th : category.title_en;
              const categoryDesc = language === 'th' ? category.description_th : category.description_en;

              const getIcon = () => {
                const iconMap: { [key: string]: React.ReactNode } = {
                  croissants: <Croissant className="h-8 w-8 text-primary-700" />,
                  breads: <Wheat className="h-8 w-8 text-primary-700" />,
                  cakes: <Cookie className="h-8 w-8 text-primary-700" />,
                  quiche: <Pizza className="h-8 w-8 text-primary-700" />,
                };
                return iconMap[category.id] || <Croissant className="h-8 w-8 text-primary-700" />;
              };

              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className="text-center space-y-4 p-6 rounded-lg hover:bg-primary-100 transition-all duration-200 cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary-200 transition-colors duration-200">
                    {getIcon()}
                  </div>
                  <h3 className="text-lg font-semibold text-primary-900 group-hover:text-primary-700 transition-colors">
                    {categoryName}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {categoryDesc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-background to-primary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary-600 rounded-2xl p-8 md:p-12 text-center text-white shadow-xl">
            <h2 className="text-3xl md:text-4xl font-header font-bold mb-4">
              {t.callToAction.title}
            </h2>
            <p className="text-lg md:text-xl mb-8 text-primary-50 whitespace-pre-line">
              {t.callToAction.subtitle}
            </p>
            <button
              onClick={() => onNavigate('products')}
              className="bg-background text-primary-900 px-10 py-4 rounded-lg font-bold text-lg hover:bg-primary-50 transition-colors inline-flex items-center"
            >
              {t.callToAction.buttonText}
              <ArrowRight className="ml-2 h-6 w-6" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
