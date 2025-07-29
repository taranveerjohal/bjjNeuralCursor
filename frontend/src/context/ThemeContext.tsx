import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeType = 'purple' | 'blackwhite';

interface ThemeColors {
  // Backgrounds
  primaryBg: string;
  secondaryBg: string;
  cardBg: string;
  
  // Gradients
  primaryGradient: string;
  secondaryGradient: string;
  buttonGradient: string;
  
  // Text colors
  primaryText: string;
  secondaryText: string;
  accentText: string;
  
  // Border colors
  primaryBorder: string;
  secondaryBorder: string;
  
  // Status colors
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  
  // UI elements
  inputBg: string;
  inputBorder: string;
  buttonHover: string;
}

const themes: Record<ThemeType, ThemeColors> = {
  purple: {
    primaryBg: 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900',
    secondaryBg: 'bg-black/20',
    cardBg: 'bg-white/5',
    
    primaryGradient: 'from-purple-500 to-pink-500',
    secondaryGradient: 'from-purple-500/20 to-pink-500/20',
    buttonGradient: 'from-purple-500 to-pink-500',
    
    primaryText: 'text-white',
    secondaryText: 'text-white/80',
    accentText: 'text-purple-300',
    
    primaryBorder: 'border-white/10',
    secondaryBorder: 'border-purple-400/30',
    
    successColor: 'text-green-400',
    warningColor: 'text-yellow-400',
    errorColor: 'text-red-400',
    infoColor: 'text-purple-400',
    
    inputBg: 'bg-white/10',
    inputBorder: 'border-white/20',
    buttonHover: 'hover:from-purple-600 hover:to-pink-600'
  },
  blackwhite: {
    primaryBg: 'bg-gradient-to-br from-gray-900 via-black to-gray-900',
    secondaryBg: 'bg-gray-800/50',
    cardBg: 'bg-gray-800/30',
    
    primaryGradient: 'from-gray-600 to-gray-800',
    secondaryGradient: 'from-gray-600/20 to-gray-800/20',
    buttonGradient: 'from-gray-700 to-gray-900',
    
    primaryText: 'text-white',
    secondaryText: 'text-gray-300',
    accentText: 'text-gray-400',
    
    primaryBorder: 'border-gray-600/30',
    secondaryBorder: 'border-gray-500/30',
    
    successColor: 'text-green-400',
    warningColor: 'text-yellow-400',
    errorColor: 'text-red-400',
    infoColor: 'text-blue-400',
    
    inputBg: 'bg-gray-800/50',
    inputBorder: 'border-gray-600/30',
    buttonHover: 'hover:from-gray-600 hover:to-gray-800'
  }
};

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem('bjj-neural-theme');
    return (savedTheme as ThemeType) || 'purple';
  });

  useEffect(() => {
    localStorage.setItem('bjj-neural-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(current => current === 'purple' ? 'blackwhite' : 'purple');
  };

  const colors = themes[theme];

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};