import { Heart, Users, Wheat } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl md:text-5xl font-header font-bold text-primary-900 mb-6 text-center">
          {t.about.title}
        </h1>

        <div className="bg-background rounded-2xl shadow-lg overflow-hidden mb-12">
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-header font-bold text-primary-900 mb-4">{t.about.story}</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              {t.about.storyText}
            </p>
            <h2 className="text-2xl font-header font-bold text-primary-900 mb-4">{t.about.mission}</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              {t.about.missionText}
            </p>
            <h2 className="text-2xl font-header font-bold text-primary-900 mb-4">{t.about.commitment}</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              {t.about.commitmentText}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-background rounded-lg shadow-md p-6 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-8 w-8 text-primary-700" />
            </div>
            <h3 className="text-xl font-semibold text-primary-900 mb-3">{t.about.madeWithLove}</h3>
            <p className="text-gray-600">
              {t.about.madeWithLoveText}
            </p>
          </div>

          <div className="bg-background rounded-lg shadow-md p-6 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wheat className="h-8 w-8 text-primary-700" />
            </div>
            <h3 className="text-xl font-semibold text-primary-900 mb-3">{t.about.qualityIngredients}</h3>
            <p className="text-gray-600">
              {t.about.qualityIngredientsText}
            </p>
          </div>

          <div className="bg-background rounded-lg shadow-md p-6 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary-700" />
            </div>
            <h3 className="text-xl font-semibold text-primary-900 mb-3">{t.about.communityFocused}</h3>
            <p className="text-gray-600">
              {t.about.communityFocusedText}
            </p>
          </div>
        </div>

        <div className="bg-primary-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-header font-bold mb-4">{t.footer.pickupLocations}</h2>
          <div className="space-y-4 text-primary-50">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">{t.location.maeRimName}</h3>
              <p>{t.location.open}: {t.location.maeRimDays}</p>
            </div>
            <div className="border-t border-primary-500 pt-4 mt-4">
              <h3 className="text-xl font-semibold text-white mb-2">{t.location.inTownName}</h3>
              <p>{t.location.open}: {t.location.inTownDays}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
