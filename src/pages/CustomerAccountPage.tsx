import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { Package, User, Loader2, Home, ShoppingCart, LogOut, Heart, Mail, Phone, MessageCircle, ChevronDown, ChevronUp, Calendar, MapPin, Clock, Store, ArrowUpDown, Star, Edit3, Save, X, Camera, Upload, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../translations';

interface CustomerProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  qr_token: string;
  short_code: string;
  loyalty_points: number | null;
  created_at: string;
  line_id: string | null;
  whatsapp: string | null;
  wechat_id: string | null;
  profile_picture_url: string | null;
}

interface OrderItem {
  id?: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  slug?: string;
}

interface Order {
  id: string;
  order_number: string;
  order_items: OrderItem[];
  total_amount: number;
  pickup_date: string;
  status: string;
  payment_status: string;
  created_at: string;
  purchase_type: 'online' | 'walk_in';
  loyalty_multiplier: number;
  pickup_location?: {
    id: string;
    name_en: string;
    name_th: string;
    name_zh: string;
  } | null;
}

interface LikedProduct {
  id: string;
  slug: string;
  name_en: string;
  name_th: string;
  name_zh: string;
  price: number;
  image: string | null;
}

type SortOption = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc';

interface CustomerAccountPageProps {
  qrToken: string;
  onNavigate: (page: string) => void;
}

export function CustomerAccountPage({ qrToken, onNavigate }: CustomerAccountPageProps) {
  const { signOut, user, loading: authLoading, session } = useAuth();
  const { setIsOpen: setCartOpen } = useCart();
  const { t, language, setLanguage } = useLanguage();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [likedProducts, setLikedProducts] = useState<LikedProduct[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    line_id: '',
    whatsapp: '',
    wechat_id: '',
  });

  const handleLogout = async () => {
    await signOut();
    onNavigate('home');
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleEditClick = () => {
    if (customer) {
      setEditForm({
        name: customer.name || '',
        phone: customer.phone || '',
        line_id: customer.line_id || '',
        whatsapp: customer.whatsapp || '',
        wechat_id: customer.wechat_id || '',
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      name: '',
      phone: '',
      line_id: '',
      whatsapp: '',
      wechat_id: '',
    });
  };

  const handleSaveProfile = async () => {
    if (!customer) return;

    try {
      setIsSaving(true);
      setError(null);

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          name: editForm.name,
          phone: editForm.phone,
          line_id: editForm.line_id || null,
          whatsapp: editForm.whatsapp || null,
          wechat_id: editForm.wechat_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (profileError) throw profileError;

      setCustomer({
        ...customer,
        name: editForm.name,
        phone: editForm.phone,
        line_id: editForm.line_id || null,
        whatsapp: editForm.whatsapp || null,
        wechat_id: editForm.wechat_id || null,
      });

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !customer) return;

    const file = event.target.files[0];

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    try {
      setIsUploadingImage(true);
      setError(null);

      const fileExt = file.name.split('.').pop();
      const fileName = `${customer.id}-${Date.now()}.${fileExt}`;
      const filePath = `${customer.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      setCustomer({
        ...customer,
        profile_picture_url: publicUrl,
      });
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      console.log('[CustomerAccountPage] Auth still loading — deferring profile query');
      return;
    }

    if (!session || !user) {
      console.log('[CustomerAccountPage] No session/user after auth resolved — cannot query');
      setLoading(false);
      setError('Please log in to view your account');
      return;
    }

    console.log('[CustomerAccountPage] Auth ready — user:', user.id, '— querying profile for token:', qrToken);

    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session: liveSession } } = await supabase.auth.getSession();
        console.log('[CustomerAccountPage] Live session uid:', liveSession?.user?.id ?? 'null');
        console.log('[CustomerAccountPage] Looking up qrToken:', qrToken);

        const selectFields = 'id, name, phone, qr_token, short_code, created_at, line_id, whatsapp, wechat_id, profile_picture_url';

        let profileData = null;
        let profileError = null;

        const byShortCode = await supabase
          .from('user_profiles')
          .select(selectFields)
          .eq('short_code', qrToken)
          .maybeSingle();
        console.log('[CustomerAccountPage] short_code lookup:', byShortCode.data, byShortCode.error);

        if (byShortCode.error) { profileError = byShortCode.error; }
        else if (byShortCode.data) { profileData = byShortCode.data; }
        else {
          const byQrToken = await supabase
            .from('user_profiles')
            .select(selectFields)
            .eq('qr_token', qrToken)
            .maybeSingle();
          console.log('[CustomerAccountPage] qr_token lookup:', byQrToken.data, byQrToken.error);
          if (byQrToken.error) { profileError = byQrToken.error; }
          else { profileData = byQrToken.data; }
        }

        if (profileError) throw profileError;
        if (!profileData) {
          setError('Customer not found');
          return;
        }

        const { data: customerData } = await supabase
          .from('customers')
          .select('email, loyalty_points')
          .eq('id', profileData.id)
          .maybeSingle();

        setCustomer({
          ...profileData,
          email: customerData?.email || null,
          loyalty_points: customerData?.loyalty_points || null,
        });

        const { data: ordersData } = await supabase
          .from('orders')
          .select(`
            id, order_number, order_items, total_amount, pickup_date, status,
            payment_status, created_at, purchase_type, loyalty_multiplier,
            cms_pickup_locations:pickup_location_id (id, name_en, name_th, name_zh)
          `)
          .eq('customer_id', profileData.id)
          .order('created_at', { ascending: false });

        if (ordersData) {
          const formattedOrders = ordersData.map((o: any) => ({
            ...o,
            purchase_type: o.purchase_type || 'online',
            loyalty_multiplier: o.loyalty_multiplier || 1,
            pickup_location: o.cms_pickup_locations,
          }));
          setOrders(formattedOrders);
        }

        const { data: likesData } = await supabase
          .from('product_likes')
          .select(`
            product_id,
            cms_products:product_id (id, slug, name_en, name_th, name_zh, price, image)
          `)
          .eq('user_id', profileData.id);

        if (likesData) {
          const products = likesData
            .filter((like: any) => like.cms_products)
            .map((like: any) => like.cms_products);
          setLikedProducts(products);
        }
      } catch (err) {
        console.error('[CustomerAccountPage] Error fetching customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [qrToken, authLoading, session, user]);

  const currentOrders = orders.filter(o => ['pending', 'confirmed', 'ready'].includes(o.status));
  const pastOrders = orders.filter(o => ['picked_up', 'completed', 'cancelled'].includes(o.status));

  const pastPickupOrders = pastOrders.filter(o => o.purchase_type === 'online');
  const pastWalkInOrders = pastOrders.filter(o => o.purchase_type === 'walk_in');

  const sortOrders = (orderList: Order[]) => {
    return [...orderList].sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price_desc':
          return b.total_amount - a.total_amount;
        case 'price_asc':
          return a.total_amount - b.total_amount;
        default:
          return 0;
      }
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t.dashboard.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.dashboard.error}</h1>
          <p className="text-gray-600">
            {error || t.dashboard.error}
          </p>
        </div>
      </div>
    );
  }

  const getLocale = () => {
    switch (language) {
      case 'th': return 'th-TH';
      case 'zh': return 'zh-CN';
      default: return 'en-US';
    }
  };

  const memberSince = new Date(customer.created_at).toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'picked_up': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentColor = (status: string) => {
    return status === 'paid'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(getLocale(), {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': t.dashboard.orderStatus.pending,
      'confirmed': t.dashboard.orderStatus.confirmed,
      'ready': t.dashboard.orderStatus.ready,
      'completed': t.dashboard.orderStatus.completed,
      'cancelled': t.dashboard.orderStatus.cancelled,
    };
    return statusMap[status] || status;
  };

  const getPaymentStatusText = (status: string) => {
    return status === 'paid' ? t.dashboard.paymentStatus.paid : t.dashboard.paymentStatus.pending;
  };

  const handleProductClick = (productSlug?: string) => {
    if (productSlug) {
      onNavigate(`products?product=${productSlug}`);
    }
  };

  const renderCurrentOrderCard = (order: Order) => {
    const isExpanded = expandedOrders.has(order.id);
    return (
      <div key={order.id} className="bg-gradient-to-br from-white to-amber-50 rounded-2xl border-2 border-amber-300 overflow-hidden shadow-md hover:shadow-lg transition-all">
        <button
          onClick={() => toggleOrderExpanded(order.id)}
          className="w-full p-5 text-left hover:bg-amber-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-amber-700 mb-3">
            <Calendar className="w-4 h-4" />
            <span className="font-bold text-lg">{formatDate(order.pickup_date)}</span>
          </div>
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-gray-800">#{order.order_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getPaymentColor(order.payment_status)}`}>
                  {getPaymentStatusText(order.payment_status)}
                </span>
              </div>
              {order.pickup_location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{order.pickup_location.name_en}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>{order.order_items?.length || 0} items</span>
                <span className="font-bold text-amber-700">฿{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-amber-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-amber-600" />
              )}
            </div>
          </div>
        </button>
        {isExpanded && (
          <div className="px-5 pb-5 border-t-2 border-amber-100 pt-4 bg-white/50">
            <div className="space-y-3">
              {order.order_items?.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleProductClick(item.slug)}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-amber-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 hover:text-amber-700 transition-colors">{item.name}</p>
                    <p className="text-sm text-gray-500">฿{item.price.toFixed(2)} x {item.quantity}</p>
                  </div>
                  <p className="font-bold text-amber-700">฿{(item.price * item.quantity).toFixed(2)}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-amber-100 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Subtotal</span>
              <span className="text-xl font-bold text-amber-700">฿{order.total_amount.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPickupOrderCard = (order: Order) => {
    const isExpanded = expandedOrders.has(order.id);
    return (
      <div key={order.id} className="bg-gradient-to-br from-white to-green-50 rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
        <button
          onClick={() => toggleOrderExpanded(order.id)}
          className="w-full p-4 text-left hover:bg-green-50/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="font-bold">{formatDate(order.pickup_date)}</span>
          </div>
          <div className="flex justify-between items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-gray-700 text-sm">#{order.order_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              {order.pickup_location && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <MapPin className="w-3 h-3" />
                  <span>{order.pickup_location.name_en}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">{order.order_items?.length || 0} items</span>
                <span className="font-bold text-green-700">฿{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-green-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-green-600" />
              )}
            </div>
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-green-100 pt-3 bg-white/50">
            <div className="space-y-2">
              {order.order_items?.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleProductClick(item.slug)}
                  className="w-full flex items-center gap-2 bg-white rounded-lg p-2 border border-green-100 hover:border-green-300 hover:shadow transition-all text-left"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-green-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 text-sm hover:text-green-700 transition-colors truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">฿{item.price.toFixed(2)} x {item.quantity}</p>
                  </div>
                  <p className="font-bold text-green-700 text-sm">฿{(item.price * item.quantity).toFixed(2)}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-green-100 flex justify-between items-center">
              <span className="font-medium text-gray-600 text-sm">Subtotal</span>
              <span className="font-bold text-green-700">฿{order.total_amount.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWalkInOrderCard = (order: Order) => {
    const loyaltyPointsEarned = Math.floor(order.total_amount * order.loyalty_multiplier);
    return (
      <div key={order.id} className="bg-gradient-to-br from-white to-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-blue-700 mb-2">
          <Calendar className="w-4 h-4" />
          <span className="font-bold text-sm">{formatDate(order.created_at)}</span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-lg text-gray-800">฿{order.total_amount.toFixed(2)}</p>
            <div className="flex items-center gap-1.5 text-sm text-amber-600">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">+{loyaltyPointsEarned} pts earned</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded-full">
            <Store className="w-3 h-3" />
            <span>In-store</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-2xl hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-semibold border-2 border-amber-200"
            >
              <Home className="w-5 h-5" />
              {t.dashboard.backToHome}
            </button>
            <button
              onClick={() => {
                onNavigate('products');
                setCartOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              <ShoppingCart className="w-5 h-5" />
              {t.dashboard.goToCart}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-md border-2 border-amber-200">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  language === 'en'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-amber-50'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('th')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  language === 'th'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-amber-50'
                }`}
              >
                TH
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  language === 'zh'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-amber-50'
                }`}
              >
                中文
              </button>
            </div>
            <div className="w-px h-10 bg-amber-300"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              <LogOut className="w-5 h-5" />
              {t.dashboard.signOut}
            </button>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border-4 border-amber-200">
          <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
            <div className="relative flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm border-3 border-white/50 shadow-lg overflow-hidden">
                  {customer.profile_picture_url ? (
                    <img
                      src={customer.profile_picture_url}
                      alt={customer.name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="absolute -bottom-1 -right-1 bg-white text-amber-600 p-2 rounded-full shadow-lg hover:bg-amber-50 transition-all disabled:opacity-50"
                  title="Upload profile picture"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-1 drop-shadow-md">
                  {customer.name || t.dashboard.welcome}
                </h1>
                <p className="text-amber-100 text-xl font-semibold tracking-wide mb-1">
                  {customer.short_code}
                </p>
                <p className="text-amber-50 text-lg">{t.dashboard.memberSince} {memberSince}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b-2 border-amber-200 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-amber-400 to-orange-400 p-2 rounded-xl">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  {t.dashboard.ordersSection}
                </h2>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-gray-500" />
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="bg-white border-2 border-amber-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  >
                    <option value="date_desc">{t.dashboard.dateLatest}</option>
                    <option value="date_asc">{t.dashboard.dateOldest}</option>
                    <option value="price_desc">{t.dashboard.priceHighLow}</option>
                    <option value="price_asc">{t.dashboard.priceLowHigh}</option>
                  </select>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <h3 className="text-lg font-bold text-gray-800">{t.dashboard.currentOrders}</h3>
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {currentOrders.length}
                    </span>
                  </div>
                  {currentOrders.length === 0 ? (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 text-center border-2 border-amber-100">
                      <Package className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">{t.dashboard.noCurrentOrders}</p>
                      <p className="text-gray-500 text-sm mt-1">{t.dashboard.noCurrentOrdersDesc}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortOrders(currentOrders).map(renderCurrentOrderCard)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-800">{t.dashboard.pastOrders}</h3>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {pastOrders.length}
                    </span>
                  </div>

                  {pastOrders.length === 0 ? (
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-8 text-center border-2 border-gray-100">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">{t.dashboard.noPastOrders}</p>
                      <p className="text-gray-500 text-sm mt-1">{t.dashboard.noPastOrdersDesc}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {pastPickupOrders.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-green-600" />
                            <h4 className="font-semibold text-gray-700">{t.dashboard.pickupOrders}</h4>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {pastPickupOrders.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {sortOrders(pastPickupOrders).map(renderPickupOrderCard)}
                          </div>
                        </div>
                      )}

                      {pastWalkInOrders.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Store className="w-4 h-4 text-blue-600" />
                            <h4 className="font-semibold text-gray-700">{t.dashboard.walkInPurchases}</h4>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {pastWalkInOrders.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {sortOrders(pastWalkInOrders).map(renderWalkInOrderCard)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-yellow-200">
                <div className="bg-gradient-to-br from-yellow-400 to-amber-400 p-2 rounded-xl">
                  <Star className="w-6 h-6 text-white" />
                </div>
                {t.dashboard.loyaltySection}
              </h2>
              <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 rounded-3xl p-8 border-4 border-yellow-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-300 rounded-full opacity-20 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-400 p-6 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform">
                      <Star className="w-16 h-16 text-white drop-shadow-lg" />
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm font-medium uppercase tracking-wider mb-2">{t.dashboard.yourTotalPoints}</p>
                      <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 drop-shadow-sm">
                        {customer.loyalty_points?.toLocaleString() || '0'}
                      </p>
                      <p className="text-gray-500 text-sm mt-2">{t.dashboard.keepShopping}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-yellow-200">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.dashboard.rewardTier}</p>
                      <div className="flex items-center gap-2 justify-center">
                        {(customer.loyalty_points || 0) >= 1000 ? (
                          <>
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <p className="text-lg font-bold text-yellow-600">{t.dashboard.goldMember}</p>
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          </>
                        ) : (customer.loyalty_points || 0) >= 500 ? (
                          <>
                            <Star className="w-5 h-5 text-gray-400 fill-gray-400" />
                            <p className="text-lg font-bold text-gray-600">{t.dashboard.silverMember}</p>
                            <Star className="w-5 h-5 text-gray-400 fill-gray-400" />
                          </>
                        ) : (
                          <>
                            <Star className="w-5 h-5 text-amber-700" />
                            <p className="text-lg font-bold text-amber-700">{t.dashboard.bronzeMember}</p>
                          </>
                        )}
                      </div>
                      {(customer.loyalty_points || 0) < 1000 && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-yellow-400 to-amber-500 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(((customer.loyalty_points || 0) % 500) / 500 * 100, 100)}%`
                              }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {(customer.loyalty_points || 0) >= 500
                              ? `${1000 - (customer.loyalty_points || 0)} ${t.dashboard.pointsToGold}`
                              : `${500 - (customer.loyalty_points || 0)} ${t.dashboard.pointsToSilver}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3 pb-3 border-b-2 border-pink-200">
                <div className="bg-gradient-to-br from-pink-400 to-rose-400 p-2 rounded-xl">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                {t.dashboard.favoritesSection}
              </h2>
              {likedProducts.length === 0 ? (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-12 text-center border-2 border-pink-100">
                  <Heart className="w-16 h-16 text-pink-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg font-medium">{t.dashboard.noFavorites}</p>
                  <p className="text-gray-500 text-sm mt-2">{t.dashboard.noFavoritesDesc}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {likedProducts.map((product) => {
                    const productName = language === 'zh' ? (product.name_zh || product.name_en) : (language === 'th' ? (product.name_th || product.name_en) : product.name_en);
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleProductClick(product.slug)}
                        className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all border-2 border-pink-100 hover:border-pink-300 text-left"
                      >
                        <div className="aspect-square bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center">
                          {product.image ? (
                            <img src={product.image} alt={productName} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-12 h-12 text-pink-300" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-gray-800 text-sm line-clamp-2 mb-1 hover:text-pink-700 transition-colors">{productName}</p>
                          <p className="text-amber-600 font-bold">฿{product.price.toFixed(2)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b-2 border-blue-200">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-blue-400 to-cyan-400 p-2 rounded-xl">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  {t.dashboard.profileSection}
                </h2>
                {!isEditing ? (
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all shadow-md hover:shadow-lg font-medium"
                  >
                    <Edit3 className="w-4 h-4" />
                    {t.dashboard.editProfile}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {t.dashboard.saveChanges}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      {t.dashboard.cancelEdit}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-100 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-blue-100">
                    <label className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2">
                      <User className="w-4 h-4 text-blue-500" />
                      {t.dashboard.name}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium text-gray-900"
                        placeholder={t.profile.enterName}
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{customer.name || t.dashboard.welcome}</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-blue-100">
                    <label className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      {t.dashboard.email}
                    </label>
                    <p className="text-gray-900 font-medium">{customer.email || t.dashboard.welcome}</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-blue-100">
                    <label className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider mb-2">
                      <Phone className="w-4 h-4 text-blue-500" />
                      {t.dashboard.phone}
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium text-gray-900"
                        placeholder={t.profile.enterPhone}
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{customer.phone}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-gray-600 font-medium mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {t.dashboard.contactInfo}
                  </p>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <label className="text-xs text-gray-500 mb-2 block">{t.dashboard.lineId}</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.line_id}
                          onChange={(e) => setEditForm({ ...editForm, line_id: e.target.value })}
                          className="w-full px-2 py-1 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                          placeholder={t.profile.enterLineId}
                        />
                      ) : (
                        <p className="text-gray-800 font-medium text-sm">{customer.line_id || '-'}</p>
                      )}
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <label className="text-xs text-gray-500 mb-2 block">{t.dashboard.whatsapp}</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.whatsapp}
                          onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                          className="w-full px-2 py-1 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                          placeholder={t.profile.enterWhatsApp}
                        />
                      ) : (
                        <p className="text-gray-800 font-medium text-sm">{customer.whatsapp || '-'}</p>
                      )}
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <label className="text-xs text-gray-500 mb-2 block">{t.dashboard.wechat}</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.wechat_id}
                          onChange={(e) => setEditForm({ ...editForm, wechat_id: e.target.value })}
                          className="w-full px-2 py-1 border border-green-300 rounded focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                          placeholder={t.profile.enterWeChatId}
                        />
                      ) : (
                        <p className="text-gray-800 font-medium text-sm">{customer.wechat_id || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-2xl p-6 border-2 border-amber-200 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                  {t.dashboard.viewMyQR}
                </h3>
                <QRCodeDisplay
                  qrToken={customer.qr_token}
                  qrValue={`${window.location.origin}/scan/${customer.short_code}`}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
