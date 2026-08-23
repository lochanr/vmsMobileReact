import { View, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  centered?: boolean;
}

export default function Screen({ children, scroll = false, centered = false }: ScreenProps) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.container, centered && styles.centered]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.container, centered && styles.centered]}>
      {children}
    </View>
  );

  return (
    <LinearGradient colors={['#0f172a', '#080c14']} style={StyleSheet.absoluteFill}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>{content}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  centered: { justifyContent: 'center', alignItems: 'center' },
});
