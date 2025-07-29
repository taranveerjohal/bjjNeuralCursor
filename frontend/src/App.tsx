import React, { useState } from "react";
import { ML5Provider } from "./context/ML5Context";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import PoseDetection from "./components/PoseDetection";
import Testing from "./components/TestingNew";
import Training from "./components/TrainingNew";

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState("pose");
  const { theme, colors, toggleTheme } = useTheme();

  const tabs = [
    { 
      id: "pose", 
      label: "Live Detection", 
      icon: "📹",
      description: "Real-time pose detection and analysis"
    },
    { 
      id: "training", 
      label: "Train Model", 
      icon: "🎯",
      description: "Record poses and train your AI model"
    },
    { 
      id: "testing", 
      label: "Test & Predict", 
      icon: "🧠",
      description: "Test your trained model with live predictions"
    }
  ];

  const getTabGradient = (isActive: boolean) => {
    if (theme === 'blackwhite') {
      return isActive 
        ? `bg-gradient-to-r from-gray-600/30 to-gray-800/30 border-2 border-gray-500/50 shadow-xl shadow-gray-500/25`
        : `bg-gray-800/20 border-2 border-gray-600/20 hover:bg-gray-700/30 hover:border-gray-500/30`;
    } else {
      return isActive
        ? `bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-2 border-purple-400/50 shadow-xl shadow-purple-500/25`
        : `bg-white/5 border-2 border-white/10 hover:bg-white/10 hover:border-white/20`;
    }
  };

  const getIconGradient = () => {
    return theme === 'blackwhite' 
      ? 'bg-gradient-to-r from-gray-600 to-gray-800'
      : 'bg-gradient-to-r from-purple-500 to-pink-500';
  };

  const getAccentColor = () => {
    return theme === 'blackwhite' ? 'text-gray-400' : 'text-purple-300';
  };

  return (
    <div className={`min-h-screen ${colors.primaryBg}`}>
      {/* Header */}
      <header className={`${colors.secondaryBg} backdrop-blur-lg border-b ${colors.primaryBorder}`}>
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 ${getIconGradient()} rounded-xl flex items-center justify-center text-2xl`}>
                🥋
              </div>
              <div>
                <h1 className={`text-4xl font-bold ${colors.primaryText} tracking-tight`}>
                  BJJ Neural
                </h1>
                <p className={`${getAccentColor()} text-sm mt-1`}>
                  AI-Powered Brazilian Jiu-Jitsu Pose Analysis
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`px-4 py-2 rounded-xl ${colors.cardBg} border ${colors.primaryBorder} ${colors.secondaryText} hover:${colors.primaryText} transition-all duration-300 flex items-center gap-2`}
                title={`Switch to ${theme === 'purple' ? 'Black & White' : 'Purple'} theme`}
              >
                {theme === 'purple' ? '⚫' : '🟣'}
                <span className="text-sm font-medium">
                  {theme === 'purple' ? 'B&W' : 'Purple'}
                </span>
              </button>
              
              {/* Status indicator */}
              <div className="flex items-center space-x-2 bg-green-500/20 px-4 py-2 rounded-full border border-green-500/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-sm font-medium">AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Navigation */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 transform hover:scale-105
                  ${getTabGradient(activeTab === tab.id)}
                `}
              >
                <div className="flex items-start space-x-4">
                  <div className={`text-3xl transition-transform duration-300 group-hover:scale-110 ${
                    activeTab === tab.id ? "animate-bounce" : ""
                  }`}>
                    {tab.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg mb-1 ${
                      activeTab === tab.id ? colors.primaryText : colors.secondaryText
                    }`}>
                      {tab.label}
                    </h3>
                    <p className={`text-sm ${
                      activeTab === tab.id ? getAccentColor() : "text-gray-400"
                    }`}>
                      {tab.description}
                    </p>
                  </div>
                </div>
                
                {/* Active indicator */}
                {activeTab === tab.id && (
                  <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-r from-transparent ${
                    theme === 'blackwhite' 
                      ? 'via-gray-600/10 to-gray-600/20' 
                      : 'via-purple-400/10 to-purple-400/20'
                  } pointer-events-none`}></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className={`${colors.secondaryBg} backdrop-blur-xl border ${colors.primaryBorder} rounded-3xl p-8 shadow-2xl`}>
          <div className="transition-all duration-500 ease-in-out">
            {activeTab === "pose" && <PoseDetection isActive={true} />}
            {activeTab === "training" && <Training isActive={true} />}
            {activeTab === "testing" && <Testing isActive={true} />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center ${colors.accentText}`}>
            <p className="text-sm">
              Powered by ML5.js • TensorFlow.js • Real-time AI Pose Detection
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ML5Provider>
        <AppContent />
      </ML5Provider>
    </ThemeProvider>
  );
};

export default App;