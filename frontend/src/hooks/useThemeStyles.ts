import { useTheme } from '../context/ThemeContext';

export const useThemeStyles = () => {
  const { theme, colors } = useTheme();

  const getButtonStyles = (variant: 'primary' | 'secondary' | 'success' | 'danger' = 'primary') => {
    const baseStyles = "px-4 py-2 rounded-xl font-medium transition-all duration-300 flex items-center gap-2";
    
    switch (variant) {
      case 'primary':
        return theme === 'blackwhite' 
          ? `${baseStyles} bg-gradient-to-r from-gray-700 to-gray-900 text-white border border-gray-600/30 hover:from-gray-600 hover:to-gray-800`
          : `${baseStyles} bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600`;
      
      case 'secondary':
        return `${baseStyles} ${colors.cardBg} border ${colors.primaryBorder} ${colors.secondaryText} hover:${colors.primaryText}`;
      
      case 'success':
        return theme === 'blackwhite'
          ? `${baseStyles} bg-gradient-to-r from-green-700 to-green-900 text-white hover:from-green-600 hover:to-green-800`
          : `${baseStyles} bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600`;
      
      case 'danger':
        return `${baseStyles} bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30`;
      
      default:
        return baseStyles;
    }
  };

  const getCardStyles = () => {
    return `${colors.cardBg} rounded-2xl border ${colors.primaryBorder} backdrop-blur-sm`;
  };

  const getInputStyles = () => {
    return `px-4 py-3 ${colors.inputBg} border ${colors.inputBorder} rounded-xl ${colors.primaryText} placeholder-white/50 focus:outline-none focus:ring-2 ${theme === 'blackwhite' ? 'focus:ring-gray-500' : 'focus:ring-purple-500'} focus:border-transparent`;
  };

  const getQualityBadgeStyles = (quality: string) => {
    const baseStyles = "px-3 py-1 rounded-full text-xs font-medium border";
    
    switch (quality) {
      case 'excellent': return `${baseStyles} bg-green-500/20 border-green-400 text-green-300`;
      case 'good': return `${baseStyles} bg-yellow-500/20 border-yellow-400 text-yellow-300`;
      case 'fair': return `${baseStyles} bg-orange-500/20 border-orange-400 text-orange-300`;
      case 'poor': return `${baseStyles} bg-red-500/20 border-red-400 text-red-300`;
      default: return `${baseStyles} bg-gray-500/20 border-gray-400 text-gray-300`;
    }
  };

  const getStatsCardStyles = (variant: 'purple' | 'blue' | 'green' | 'orange' = 'purple') => {
    if (theme === 'blackwhite') {
      return `${colors.cardBg} rounded-xl p-4 border border-gray-500/30`;
    }
    
    switch (variant) {
      case 'purple': return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-400/30';
      case 'blue': return 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-400/30';
      case 'green': return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-400/30';
      case 'orange': return 'bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-4 border border-orange-400/30';
      default: return `${colors.cardBg} rounded-xl p-4 border ${colors.primaryBorder}`;
    }
  };

  const getCheckboxStyles = () => {
    return `w-4 h-4 bg-transparent border-2 border-white/30 rounded ${theme === 'blackwhite' ? 'text-gray-500 focus:ring-gray-500' : 'text-purple-500 focus:ring-purple-500'} focus:ring-2`;
  };

  return {
    colors,
    theme,
    getButtonStyles,
    getCardStyles,
    getInputStyles,
    getQualityBadgeStyles,
    getStatsCardStyles,
    getCheckboxStyles
  };
};