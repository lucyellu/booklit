import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User, LogOut, Settings, BookOpen, Star } from 'lucide-react';

interface UserProfileProps {
  user: any;
  isDarkMode: boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl glass transition-all duration-200 hover:scale-105 border ${
          isDarkMode 
            ? 'bg-black/20 text-white/80 hover:bg-black/30 hover:text-white border-white/10' 
            : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:text-gray-900 border-white/20'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <User className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className={`absolute top-full right-0 mt-2 p-4 rounded-2xl backdrop-blur-3xl border shadow-2xl w-64 max-w-[calc(100vw-1.5rem)] z-50 ${
            isDarkMode 
              ? 'bg-black/80 border-white/20' 
              : 'bg-white/80 border-white/40'
          }`}>
            {/* User Info */}
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-white/10">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {user.displayName || 'User'}
                </p>
                <p className={`text-sm truncate ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-100/50'
              }`}>
                <div className="flex items-center space-x-2">
                  <BookOpen className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <span className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Books</span>
                </div>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3</p>
              </div>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-white/10' : 'bg-gray-100/50'
              }`}>
                <div className="flex items-center space-x-2">
                  <Star className={`w-4 h-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`} />
                  <span className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Reading</span>
                </div>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>2h</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 text-left ${
                  isDarkMode 
                    ? 'text-white/80 hover:bg-white/10' 
                    : 'text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Account Settings</span>
              </button>
              
              <button
                onClick={handleSignOut}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 text-left ${
                  isDarkMode 
                    ? 'text-red-300 hover:bg-red-500/20' 
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserProfile;