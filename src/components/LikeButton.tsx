import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toggleLike } from '../lib/likesService';

interface LikeButtonProps {
  productId: string;
  initialLiked?: boolean;
  likeCount?: number;
  onLikeChange?: (isLiked: boolean, newCount: number) => void;
  onLoginRequired?: () => void;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function LikeButton({
  productId,
  initialLiked = false,
  likeCount = 0,
  onLikeChange,
  onLoginRequired,
  showCount = true,
  size = 'md',
}: LikeButtonProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    setCount(likeCount);
  }, [likeCount]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      onLoginRequired?.();
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setIsAnimating(true);

    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : Math.max(0, count - 1);

    setLiked(newLiked);
    setCount(newCount);

    const result = await toggleLike(user.id, productId, liked);

    if (!result.success) {
      setLiked(liked);
      setCount(count);
    } else {
      onLikeChange?.(result.isLiked, newCount);
    }

    setIsLoading(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        flex items-center gap-1.5 rounded-full transition-all duration-200
        ${buttonSizeClasses[size]}
        ${liked
          ? 'bg-primary-100 text-primary-600 hover:bg-primary-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
        }
        ${isAnimating ? 'scale-110' : 'scale-100'}
        ${isLoading ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
      `}
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      <Heart
        className={`
          ${sizeClasses[size]}
          transition-all duration-200
          ${liked ? 'fill-primary-600 stroke-primary-600' : 'stroke-current fill-none'}
          ${isAnimating ? 'scale-125' : 'scale-100'}
        `}
      />
      {showCount && count > 0 && (
        <span className={`${textSizeClasses[size]} font-medium`}>
          {count}
        </span>
      )}
    </button>
  );
}
