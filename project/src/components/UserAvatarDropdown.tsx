import React, { useState, useRef, useEffect } from 'react';
import { User, QrCode, Package, UserCircle, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { getPermissions } from '../lib/rolePermissions';

interface UserAvatarDropdownProps {
  onNavigate: (page: string) => void;
}

export function UserAvatarDropdown({ onNavigate }: UserAvatarDropdownProps) {
  const { user, userProfile, userRole, signOut } = useAuth();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const permissions = userRole ? getPermissions(userRole) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  const handleMenuClick = (page: string) => {
    setIsOpen(false);
    onNavigate(page);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return null;
  }

  const userName = userProfile?.name || user.email?.split('@')[0] || 'User';
  const initials = getInitials(userName);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold shadow-md hover:shadow-lg transition-all hover:scale-105 overflow-hidden"
      >
        {userProfile?.profile_picture_url ? (
          <img
            src={userProfile.profile_picture_url}
            alt={userName}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          <div className="py-1">
            {permissions?.canAccessAdmin && (
              <button
                onClick={() => handleMenuClick('admin')}
                className="w-full px-4 py-2.5 text-left text-sm text-purple-700 hover:bg-purple-50 flex items-center gap-3 transition-colors font-medium"
              >
                <Settings className="w-4 h-4 text-purple-600" />
                {language === 'en' ? 'CMS Admin' : 'ศูนย์ควบคุม'}
              </button>
            )}

            <button
              onClick={() => handleMenuClick('my-qr')}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-3 transition-colors"
            >
              <QrCode className="w-4 h-4 text-amber-600" />
              {getLabel('nav.my_qr', language, 'My QR Code')}
            </button>

            <button
              onClick={() => handleMenuClick('orders')}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-3 transition-colors"
            >
              <Package className="w-4 h-4 text-amber-600" />
              {getLabel('nav.my_orders', language, 'My Orders')}
            </button>

            <button
              onClick={() => handleMenuClick('profile')}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-3 transition-colors"
            >
              <UserCircle className="w-4 h-4 text-amber-600" />
              {getLabel('nav.my_profile', language, 'My Profile')}
            </button>
          </div>

          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {getLabel('nav.logout', language, 'Log Out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
