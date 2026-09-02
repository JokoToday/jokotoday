import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

export type CartProduct = {
  id: string;
  name_en: string;
  name_th: string;
  name_zh?: string | null;
  price: number;
  image_url?: string | null;
  image?: string | null;
  available_days?: string[] | null;
  stock_by_day?: Record<string, number> | null;
  stock_remaining?: number | null;
  slug?: string;
  category_id?: string;
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

export type AddToCartOptions = {
  openCart?: boolean;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: CartProduct, quantity: number, options?: AddToCartOptions) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  selectedPickupDay: string | null;
  setSelectedPickupDay: (day: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (categoryId: string | null) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const LEGACY_CART_STORAGE_KEY = 'joko-cart';
const LEGACY_PICKUP_DAY_STORAGE_KEY = 'joko-pickup-day';
const LEGACY_CART_OWNER_STORAGE_KEY = 'joko-cart-owner';
const GUEST_STORAGE_ID = 'guest';

const getCartStorageKey = (userId: string | null) =>
  `joko-cart:${userId ?? GUEST_STORAGE_ID}`;

const getPickupDayStorageKey = (userId: string | null) =>
  `joko-pickup-day:${userId ?? GUEST_STORAGE_ID}`;

const readCartItems = (storageKey: string): CartItem[] => {
  const savedCart = localStorage.getItem(storageKey);
  if (!savedCart) return [];

  try {
    const parsedCart = JSON.parse(savedCart);
    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
};

const readStoredCart = (userId: string | null) => ({
  items: readCartItems(getCartStorageKey(userId)),
  pickupDay: localStorage.getItem(getPickupDayStorageKey(userId)),
});

const writeStoredCart = (
  userId: string | null,
  items: CartItem[],
  pickupDay: string | null
) => {
  localStorage.setItem(getCartStorageKey(userId), JSON.stringify(items));

  if (pickupDay) {
    localStorage.setItem(getPickupDayStorageKey(userId), pickupDay);
  } else {
    localStorage.removeItem(getPickupDayStorageKey(userId));
  }
};

const clearStoredCart = (userId: string | null) => {
  localStorage.removeItem(getCartStorageKey(userId));
  localStorage.removeItem(getPickupDayStorageKey(userId));
};

const mergeCartItems = (savedItems: CartItem[], incomingItems: CartItem[]) => {
  const merged = new Map<string, CartItem>();

  savedItems.forEach((item) => {
    merged.set(item.product.id, item);
  });

  incomingItems.forEach((item) => {
    const existing = merged.get(item.product.id);
    merged.set(
      item.product.id,
      existing
        ? {
            product: item.product,
            quantity: existing.quantity + item.quantity,
          }
        : item
    );
  });

  return Array.from(merged.values());
};

const migrateLegacyCart = (currentUserId: string | null) => {
  const legacyOwner = localStorage.getItem(LEGACY_CART_OWNER_STORAGE_KEY);
  const legacyCart = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
  const legacyPickupDay = localStorage.getItem(LEGACY_PICKUP_DAY_STORAGE_KEY);

  const hasLegacyState =
    legacyOwner !== null || legacyCart !== null || legacyPickupDay !== null;

  if (!hasLegacyState) return;

  const canSafelyMigrate = currentUserId
    ? legacyOwner === currentUserId
    : legacyOwner === null;

  if (canSafelyMigrate) {
    const existing = readStoredCart(currentUserId);
    const legacyItems = readCartItems(LEGACY_CART_STORAGE_KEY);
    const mergedItems = mergeCartItems(existing.items, legacyItems);
    const pickupDay = legacyPickupDay ?? existing.pickupDay;

    writeStoredCart(currentUserId, mergedItems, pickupDay);
  }

  localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
  localStorage.removeItem(LEGACY_PICKUP_DAY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_CART_OWNER_STORAGE_KEY);
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedPickupDay, setSelectedPickupDay] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [stateOwnerId, setStateOwnerId] = useState<string | null | undefined>(undefined);
  const activeUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading || storageReady) return;

    const currentUserId = user?.id ?? null;
    migrateLegacyCart(currentUserId);

    const stored = readStoredCart(currentUserId);
    setItems(stored.items);
    setSelectedPickupDay(stored.pickupDay);
    activeUserId.current = currentUserId;
    setStateOwnerId(currentUserId);
    setStorageReady(true);
  }, [authLoading, storageReady, user?.id]);

  useEffect(() => {
    if (authLoading || !storageReady) return;

    const nextUserId = user?.id ?? null;
    const previousUserId = activeUserId.current;

    if (previousUserId === undefined || previousUserId === nextUserId) return;

    writeStoredCart(previousUserId, items, selectedPickupDay);

    if (previousUserId === null && nextUserId) {
      const savedUserCart = readStoredCart(nextUserId);
      const mergedItems = mergeCartItems(savedUserCart.items, items);
      const mergedPickupDay = selectedPickupDay ?? savedUserCart.pickupDay;

      clearStoredCart(null);
      activeUserId.current = nextUserId;
      writeStoredCart(nextUserId, mergedItems, mergedPickupDay);
      setItems(mergedItems);
      setSelectedPickupDay(mergedPickupDay);
      setStateOwnerId(nextUserId);
      return;
    }

    if (previousUserId && nextUserId === null) {
      clearStoredCart(null);
      activeUserId.current = null;
      setItems([]);
      setSelectedPickupDay(null);
      setStateOwnerId(null);
      setIsCartOpen(false);
      return;
    }

    const savedNextUserCart = readStoredCart(nextUserId);
    activeUserId.current = nextUserId;
    setItems(savedNextUserCart.items);
    setSelectedPickupDay(savedNextUserCart.pickupDay);
    setStateOwnerId(nextUserId);
    setIsCartOpen(false);
  }, [authLoading, storageReady, user?.id]);

  useEffect(() => {
    if (!storageReady || stateOwnerId === undefined) return;

    const currentUserId = user?.id ?? null;
    if (stateOwnerId !== currentUserId) return;

    localStorage.setItem(
      getCartStorageKey(stateOwnerId),
      JSON.stringify(items)
    );
  }, [items, stateOwnerId, storageReady, user?.id]);

  useEffect(() => {
    if (!storageReady || stateOwnerId === undefined) return;

    const currentUserId = user?.id ?? null;
    if (stateOwnerId !== currentUserId) return;

    const pickupDayStorageKey = getPickupDayStorageKey(stateOwnerId);
    if (selectedPickupDay) {
      localStorage.setItem(pickupDayStorageKey, selectedPickupDay);
    } else {
      localStorage.removeItem(pickupDayStorageKey);
    }
  }, [selectedPickupDay, stateOwnerId, storageReady, user?.id]);

  const addToCart = (product: CartProduct, quantity: number, options: AddToCartOptions = {}) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...currentItems, { product, quantity }];
    });
    if (options.openCart !== false) setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setSelectedPickupDay(null);
    setIsCartOpen(false);

    if (activeUserId.current !== undefined) {
      clearStoredCart(activeUserId.current);
    }
  };

  const currentUserId = user?.id ?? null;
  const cartIdentityReady = storageReady && stateOwnerId === currentUserId;
  const visibleItems = cartIdentityReady ? items : [];
  const visiblePickupDay = cartIdentityReady ? selectedPickupDay : null;
  const totalItems = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = visibleItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: visibleItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        selectedPickupDay: visiblePickupDay,
        setSelectedPickupDay,
        selectedCategory,
        setSelectedCategory,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
