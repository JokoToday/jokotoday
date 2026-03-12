import { useState, useEffect } from 'react';
import { Heart, ShoppingBag, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { fetchLikedProducts } from '../lib/likesService';
import { CMSProduct } from '../lib/cmsService';
import ProductCard from '../components/ProductCard';
import { AuthModal } from '../components/AuthModal';

interface MyLikesPageProps {
  onNavigate: (page: string) => void;
}

export function MyLikesPage({ onNavigate }: MyLikesPageProps) {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const { refreshLikes } = useLikes();
  const [likedProducts, setLikedProducts] = useState<CMSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const labels = {
    en: {
      myLikes: 'My Favorites',
      empty: "You haven't liked any products yet",
      emptyHint: 'Browse our products and tap the heart to save your favorites!',
      browseProducts: 'Browse Products',
      back: 'Back',
      loading: 'Loading your favorites...',
      signInRequired: 'Please sign in to view your favorites',
      signIn: 'Sign In',
    },
    th: {
      myLikes: 'รายการที่ถูกใจ',
      empty: 'คุณยังไม่ได้กดถูกใจสินค้าใดเลย',
      emptyHint: 'เลือกดูสินค้าของเราและกดรูปหัวใจเพื่อบันทึกรายการที่ชอบ',
      browseProducts: 'ดูสินค้า',
      back: 'กลับ',
      loading: 'กำลังโหลดรายการที่ถูกใจ...',
      signInRequired: 'กรุณาเข้าสู่ระบบเพื่อดูรายการที่ถูกใจ',
      signIn: 'เข้าสู่ระบบ',
    },
    zh: {
      myLikes: '我的收藏',
      empty: '您还没有收藏任何商品',
      emptyHint: '浏览我们的商品，点击爱心收藏您喜欢的商品！',
      browseProducts: '浏览商品',
      back: '返回',
      loading: '正在加载您的收藏...',
      signInRequired: '请登录以查看您的收藏',
      signIn: '登录',
    },
  };

  const t = labels[language] || labels.en;

  useEffect(() => {
    if (user) {
      loadLikedProducts();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadLikedProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const products = await fetchLikedProducts(user.id);
      setLikedProducts(products as CMSProduct[]);
    } catch (error) {
      console.error('Error loading liked products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    refreshLikes();
    loadLikedProducts();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>

          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-primary-900 mb-3">{t.myLikes}</h1>
            <p className="text-gray-600 text-center max-w-md mb-6">{t.signInRequired}</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              {t.signIn}
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          {t.back}
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Heart className="w-8 h-8 text-primary-600 fill-primary-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-header font-bold text-primary-900 mb-2">
            {t.myLikes}
          </h1>
          {likedProducts.length > 0 && (
            <p className="text-gray-600">
              {likedProducts.length} {likedProducts.length === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">{t.loading}</p>
          </div>
        ) : likedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <Heart className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t.empty}</h2>
            <p className="text-gray-600 text-center max-w-md mb-8">{t.emptyHint}</p>
            <button
              onClick={() => onNavigate('products')}
              className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {t.browseProducts}
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {likedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onLoginRequired={() => setShowAuthModal(true)}
              />
            ))}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
