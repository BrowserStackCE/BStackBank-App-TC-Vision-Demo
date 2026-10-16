import { ThemeStore } from '@/store/theme';
import { useEffect, useState } from 'react';

export function useTheme() {
  const [greenMode, setGreenMode] = useState(ThemeStore.isGreenMode());

  useEffect(() => {
    const unsub = ThemeStore.subscribe(() => setGreenMode(ThemeStore.isGreenMode()));
    return unsub;
  }, []);

  return {
    greenMode,
    primaryColor: greenMode ? '#059669' : '#4F46E5',
    primaryBg: greenMode ? '#F0FDF4' : '#EEF2FF',
    primaryBorder: greenMode ? '#BBF7D0' : '#C7D2FE',
    primaryLight: greenMode ? '#6EE7B7' : '#818CF8',
  };
}