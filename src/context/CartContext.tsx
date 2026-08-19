import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
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

const CART_STORAGE_KEY = 'joko-cart';
const PICKUP_DAY_STORAGE_KEY = 'joko-pickup-day';
const CART_OWNER_STORAGE_KEY = 'joko-cart-owner';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedPickupDay, setSelectedPickupDay] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const previousUserId = useRef<string | null | undefined>(undefined);

  const clearPersistedCart = () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(PICKUP_DAY_STORAGE_KEY);
    localStorage.removeItem(CART_OWNER_STORAGE_KEY);
  };

  useEffect(() => {
    if (authLoading || storageReady) return;

    const currentUserId = user?.id ?? null;
    const savedOwner = localStorage.getItem(CART_OWNER_STORAGE_KEY);

    // A cart owned by a previously authenticated user must never be restored
    // for another account or for a signed-out visitor.
    if (savedOwner && savedOwner !== currentUserId) {
      clearPersistedCart();
      setItems([]);
      setSelectedPickupDay(null);
    } else {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (Array.isArray(parsedCart)) {
            setItems(parsedCart);
          }
        } catch {
          localStorage.removeItem(CART_STORAGE_KEY);
        }
      }

      const savedPickupDay = localStorage.getItem(PICKUP_DAY_STORAGE_KEY);
      if (savedPickupDay) {
        setSelectedPickupDay(savedPickupDay);
      }
    }

    if (currentUserId) {
      localStorage.setItem(CART_OWNER_STORAGE_KEY, currentUserId);
    }

    previousUserId.current = currentUserId;
    setStorageReady(true);
  }, [authLoading, storageReady, user?.id]);

  useEffect(() => {
    if (!storageReady) return;

    const currentUserId = user?.id ?? null;
    const priorUserId = previousUserId.current;

    if (priorUserId === currentUserId) return;

    // Guest -> authenticated: keep the guest's current cart and assign it to
    // the account they just signed into. All other auth transitions clear it.
    if (priorUserId === null && currentUserId) {
      localStorage.setItem(CART_OWNER_STORAGE_KEY, currentUserId);
    } else {
      setItems([]);
      setSelectedPickupDay(null);
      setIsCartOpen(false);
      clearPersistedCart();

      if (currentUserId) {
        localStorage.setItem(CART_OWNER_STORAGE_KEY, currentUserId);
      }
    }

    previousUserId.current = currentUserId;
  }, [storageReady, user?.id]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, storageReady]);

  useEffect(() => {
    if (!storageReady) return;

    if (selectedPickupDay) {
      localStorage.setItem(PICKUP_DAY_STORAGE_KEY, selectedPickupDay);
    } else {
      localStorage.removeItem(PICKUP_DAY_STORAGE_KEY);
    }
  }, [selectedPickupDay, storageReady]);

  const addToCart = (product: Product, quantity: number) => {
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
    setIsCartOpen(true);
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
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(PICKUP_DAY_STORAGE_KEY);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        selectedPickupDay,
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
