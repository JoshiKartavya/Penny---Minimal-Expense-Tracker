import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/Header';

import { useAppContext } from '../AppContext';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppContext();
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Global Header sits above the Swipeable Tabs */}
      <Header />
      
      <MaterialTopTabs
        screenOptions={{
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.indicator,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          swipeEnabled: true,
        }}
      >
        <MaterialTopTabs.Screen
          name="activity"
          options={{ title: 'Activity' }}
        />
        <MaterialTopTabs.Screen
          name="index"
          options={{ title: 'Wallet' }}
        />
        <MaterialTopTabs.Screen
          name="split"
          options={{ title: 'Split' }}
        />
      </MaterialTopTabs>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  tabItem: {
    width: 'auto',
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  indicator: {
    backgroundColor: colors.primary,
    height: 2,
    borderRadius: 2,
    marginBottom: -1, // Sits exactly on the bottom border
  },
});
