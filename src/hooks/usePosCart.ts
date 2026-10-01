import { useMemo, useState } from 'react';
import type { CMSProduct } from '../lib/cmsService';

export type PosCartItem = {
  product: CMSProduct;
  quantity: number;
};

const MAX_POS_QUANTITY = 99;

export function usePosCart() {
  const [items, setItems] = useState<PosCartItem[]>([]);

  const addProduct = (product: CMSProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];

      return current.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: Math.min(MAX_POS_QUANTITY, item.quantity + 1) }
          : item
      );
    });
  };

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((current) => current.filter((item) => item.product.id !== productId));
      return;
    }

    const nextQuantity = Math.min(MAX_POS_QUANTITY, Math.max(1, Math.trunc(quantity)));
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: nextQuantity } : item
      )
    );
  };

  const increment = (productId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(MAX_POS_QUANTITY, item.quantity + 1) }
          : item
      )
    );
  };

  const decrement = (productId: string) => {
    setItems((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const remove = (productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  };

  const clear = () => setItems([]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const previewSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
    [items]
  );

  const quantityFor = (productId: string) =>
    items.find((item) => item.product.id === productId)?.quantity ?? 0;

  return {
    items,
    addProduct,
    setQuantity,
    increment,
    decrement,
    remove,
    clear,
    totalQuantity,
    previewSubtotal,
    quantityFor,
  };
}

export type PosCartState = ReturnType<typeof usePosCart>;
