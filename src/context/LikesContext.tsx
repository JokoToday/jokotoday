import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchAllLikeCounts,
  fetchUserLikes,
  likeProduct,
  unlikeProduct,
  subscribeToLikes,
} from '../lib/likesService';

interface LikesContextType {
  likeCounts: Map<string, number>;
  userLikes: Set<string>;
  isLoading: boolean;
  isLiked: (productId: string) => boolean;
  getLikeCount: (productId: string) => number;
  toggleProductLike: (productId: string) => Promise<boolean>;
  refreshLikes: () => Promise<void>;
}

const LikesContext = createContext<LikesContextType | undefined>(undefined);

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadLikes = useCallback(async () => {
    setIsLoading(true);
    try {
      const counts = await fetchAllLikeCounts();
      setLikeCounts(counts);

      if (user) {
        const likes = await fetchUserLikes(user.id);
        setUserLikes(likes);
      } else {
        setUserLikes(new Set());
      }
    } catch (error) {
      console.error('Error loading likes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLikes();
  }, [loadLikes]);

  useEffect(() => {
    const channel = subscribeToLikes((payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const productId = payload.new.product_id;
        setLikeCounts((prev) => {
          const newMap = new Map(prev);
          newMap.set(productId, (prev.get(productId) || 0) + 1);
          return newMap;
        });
        if (user && payload.new.user_id === user.id) {
          setUserLikes((prev) => new Set([...prev, productId]));
        }
      } else if (payload.eventType === 'DELETE' && payload.old) {
        const productId = payload.old.product_id;
        setLikeCounts((prev) => {
          const newMap = new Map(prev);
          const currentCount = prev.get(productId) || 0;
          if (currentCount > 1) {
            newMap.set(productId, currentCount - 1);
          } else {
            newMap.delete(productId);
          }
          return newMap;
        });
        if (user && payload.old.user_id === user.id) {
          setUserLikes((prev) => {
            const newSet = new Set(prev);
            newSet.delete(productId);
            return newSet;
          });
        }
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const isLiked = useCallback(
    (productId: string) => userLikes.has(productId),
    [userLikes]
  );

  const getLikeCount = useCallback(
    (productId: string) => likeCounts.get(productId) || 0,
    [likeCounts]
  );

  const toggleProductLike = useCallback(
    async (productId: string) => {
      if (!user) return false;

      const currentlyLiked = userLikes.has(productId);

      setUserLikes((prev) => {
        const newSet = new Set(prev);
        if (currentlyLiked) {
          newSet.delete(productId);
        } else {
          newSet.add(productId);
        }
        return newSet;
      });

      setLikeCounts((prev) => {
        const newMap = new Map(prev);
        const currentCount = prev.get(productId) || 0;
        if (currentlyLiked) {
          if (currentCount > 1) {
            newMap.set(productId, currentCount - 1);
          } else {
            newMap.delete(productId);
          }
        } else {
          newMap.set(productId, currentCount + 1);
        }
        return newMap;
      });

      try {
        const success = currentlyLiked
          ? await unlikeProduct(user.id, productId)
          : await likeProduct(user.id, productId);

        if (!success) {
          setUserLikes((prev) => {
            const newSet = new Set(prev);
            if (currentlyLiked) {
              newSet.add(productId);
            } else {
              newSet.delete(productId);
            }
            return newSet;
          });

          setLikeCounts((prev) => {
            const newMap = new Map(prev);
            const currentCount = prev.get(productId) || 0;
            if (currentlyLiked) {
              newMap.set(productId, currentCount + 1);
            } else {
              if (currentCount > 1) {
                newMap.set(productId, currentCount - 1);
              } else {
                newMap.delete(productId);
              }
            }
            return newMap;
          });
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error toggling like:', error);
        return false;
      }
    },
    [user, userLikes]
  );

  const refreshLikes = useCallback(async () => {
    await loadLikes();
  }, [loadLikes]);

  return (
    <LikesContext.Provider
      value={{
        likeCounts,
        userLikes,
        isLoading,
        isLiked,
        getLikeCount,
        toggleProductLike,
        refreshLikes,
      }}
    >
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  const context = useContext(LikesContext);
  if (!context) {
    throw new Error('useLikes must be used within LikesProvider');
  }
  return context;
}
