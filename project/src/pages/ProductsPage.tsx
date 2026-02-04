import { useState, useEffect } from 'react';
import { supabase, Category, Product } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import { PickupDaySelector } from '../components/PickupDaySelector';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { getCategories, getProducts, CMSCategory, CMSProduct } from '../lib/cmsService';
import { getPickupDays, isDayOpenForOrdering, getCutoffDayAndTime, getPickupDayLabel, PickupDay } from '../lib/availabilityService';

export default function ProductsPage() {
  const { t, language } = useLanguage();
  const { selectedPickupDay, setSelectedPickupDay, selectedCategory, setSelectedCategory } = useCart();
  const [categories, setCategories] = useState<CMSCategory[]>([]);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    if (!selectedCategory) {
      setSelectedCategory('all');
    }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cmsCategories, cmsProducts, days] = await Promise.all([
        getCategories(),
        getProducts(),
        getPickupDays(),
      ]);

      setCategories(cmsCategories);
      setProducts(cmsProducts);
      setPickupDays(days);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchesPickupDay = !selectedPickupDay || (p.available_days && (p.available_days as string[]).includes(selectedPickupDay));
    return matchesCategory && matchesPickupDay;
  });

  const dayOptions = pickupDays.map(day => ({
    label: day.label,
    displayLabel: getPickupDayLabel(day, language),
    key: day.day_key
  }));

  const getIsOpen = (label: string): boolean => {
    const day = pickupDays.find((d) => d.label === label);
    return day ? isDayOpenForOrdering(day) : true;
  };

  const getPickupDayObject = (label: string): PickupDay | undefined => {
    return pickupDays.find((d) => d.label === label);
  };

  // Get available and closed days for the selector
  const availableDays = dayOptions.filter(d => getIsOpen(d.label)).map(d => d.label);
  const closedDays = dayOptions.filter(d => !getIsOpen(d.label)).map(d => d.label);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-header font-bold text-primary-900 mb-4">
            {t.nav.products}
          </h1>
          <p className="text-lg text-gray-700">
            {t.product.preOrderOnly}
          </p>
        </div>

        <PickupDaySelector
          selectedPickupDay={selectedPickupDay}
          onPickupDayChange={setSelectedPickupDay}
          availableDays={availableDays}
          closedDays={closedDays}
        />

        <div className="mb-8">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-6 py-2.5 rounded-full font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-background text-primary-900 hover:bg-primary-100 border border-primary-200'
              }`}
            >
              {t.categories.all}
            </button>
            {categories.map((category) => {
              const categoryName = language === 'th' ? category.title_th : category.title_en;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-6 py-2.5 rounded-full font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-background text-primary-900 hover:bg-primary-100 border border-primary-200'
                  }`}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading delicious items...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">
              {selectedPickupDay
                ? 'No products available for this pickup day and category.'
                : 'Please select a pickup day to see available products.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} selectedDay={selectedPickupDay} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
