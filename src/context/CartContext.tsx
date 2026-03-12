import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../lib/supabase';

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedPickupDay, setSelectedPickupDay] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem('joko-cart');
    if (savedCart) {
      setItems(JSON.parse(savedCart));
    }
    const savedPickupDay = localStorage.getItem('joko-pickup-day');
    if (savedPickupDay) {
      setSelectedPickupDay(savedPickupDay);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('joko-cart', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (selectedPickupDay) {
      localStorage.setItem('joko-pickup-day', selectedPickupDay);
    } else {
      localStorage.removeItem('joko-pickup-day');
    }
  }, [selectedPickupDay]);

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
    localStorage.removeItem('joko-cart');
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
