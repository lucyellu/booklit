import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { X, Mail, Lock, User, Chrome } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, isDarkMode }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 p-6 rounded-2xl backdrop-blur-3xl border shadow-2xl ${
        isDarkMode 
          ? 'bg-black/80 border-white/20' 
          : 'bg-white/80 border-white/40'
      }`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isDarkMode 
              ? 'text-white/60 hover:text-white hover:bg-white/10' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
            {isSignUp 
              ? 'Join to save your library and reading progress' 
              : 'Welcome back! Sign in to access your library'
            }
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className={`w-full flex items-center justify-center space-x-3 p-3 rounded-xl border transition-all duration-200 mb-4 ${
            loading 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-[1.02]'
          } ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' 
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Chrome className="w-5 h-5" />
          <span className="font-medium">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative mb-4">
          <div className={`absolute inset-0 flex items-center ${
            isDarkMode ? 'text-white/30' : 'text-gray-400'
          }`}>
            <div className="w-full border-t border-current" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-2 ${
              isDarkMode ? 'bg-black/80 text-white/60' : 'bg-white/80 text-gray-600'
            }`}>
              or
            </span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? 'text-white/50' : 'text-gray-400'
              }`} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                  isDarkMode 
                    ? 'bg-black/20 text-white/80 placeholder-white/50 border-white/10' 
                    : 'bg-white/30 text-gray-700 placeholder-gray-500 border-white/20'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? 'text-white/50' : 'text-gray-400'
              }`} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-0 focus:ring-2 focus:ring-blue-400 transition-all duration-200 backdrop-blur-xl border ${
                  isDarkMode 
                    ? 'bg-black/20 text-white/80 placeholder-white/50 border-white/10' 
                    : 'bg-white/30 text-gray-700 placeholder-gray-500 border-white/20'
                }`}
              />
            </div>
          </div>

          {error && (
            <div className={`text-sm p-3 rounded-lg ${
              isDarkMode 
                ? 'bg-red-500/20 text-red-300 border border-red-400/30' 
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
              loading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:scale-[1.02]'
            } ${
              isDarkMode 
                ? 'bg-blue-500/30 text-blue-300 hover:bg-blue-500/40 border border-blue-400/30' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Please wait...</span>
              </div>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Toggle Sign Up/Sign In */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className={`text-sm font-medium transition-colors ${
              isDarkMode 
                ? 'text-blue-300 hover:text-blue-200' 
                : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;