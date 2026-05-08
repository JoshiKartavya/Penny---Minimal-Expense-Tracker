import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useAppContext } from '../app/AppContext';

export default function AppText({ style, children, ...props }) {
  const { fontScale, colors } = useAppContext();

  // Extract base fontSize if it exists, otherwise default to 14
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const baseFontSize = flattenedStyle.fontSize || 14;
  
  // Apply the scale
  const scaledFontSize = baseFontSize * fontScale;

  return (
    <Text {...props} style={[{ color: colors.text }, style, { fontSize: scaledFontSize }]}>
      {children}
    </Text>
  );
}
