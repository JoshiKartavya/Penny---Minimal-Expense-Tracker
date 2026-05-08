import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/translations';
import { Colors } from '../constants/Colors';

const AppContext = createContext();

export const SETTINGS_KEYS = {
  LANGUAGE: '@tracker_language',
  FONT_SCALE: '@tracker_font_scale',
  THEME: '@tracker_theme'
};

export const AppProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [fontScale, setFontScale] = useState(1.0);
  const [themeOverride, setThemeOverride] = useState('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedLang = await AsyncStorage.getItem(SETTINGS_KEYS.LANGUAGE);
        const storedScale = await AsyncStorage.getItem(SETTINGS_KEYS.FONT_SCALE);
        const storedTheme = await AsyncStorage.getItem(SETTINGS_KEYS.THEME);
        if (storedLang) setLanguage(storedLang);
        if (storedScale) setFontScale(parseFloat(storedScale));
        if (storedTheme) setThemeOverride(storedTheme);
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem(SETTINGS_KEYS.LANGUAGE, lang);
  };

  const changeFontScale = async (scale) => {
    setFontScale(scale);
    await AsyncStorage.setItem(SETTINGS_KEYS.FONT_SCALE, scale.toString());
  };

  const changeTheme = async (theme) => {
    setThemeOverride(theme);
    await AsyncStorage.setItem(SETTINGS_KEYS.THEME, theme);
  };

  // Translation helper
  const t = (key) => {
    const langDict = translations[language] || translations['en'];
    return langDict[key] || translations['en'][key] || key;
  };

  const systemColorScheme = useColorScheme();
  const isDark = themeOverride === 'dark' || (themeOverride === 'system' && systemColorScheme === 'dark');
  const colors = Colors[isDark ? 'dark' : 'light'];

  if (!isLoaded) return null;

  return (
    <AppContext.Provider value={{ language, changeLanguage, fontScale, changeFontScale, themeOverride, changeTheme, t, colors, isDark }}>
      {children}
    </AppContext.Provider>
  );
};

export default function DummyContextRoute() {
  return null;
}

export const useAppContext = () => useContext(AppContext);
