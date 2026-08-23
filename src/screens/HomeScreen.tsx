import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/layout/Screen';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const items = [
  { icon: '👤', title: 'New Visitor', sub: 'Register & get your pass', route: 'Phone' as const, accent: true },
  { icon: '🔍', title: 'Recover Pass', sub: 'Already registered?', route: 'Recover' as const, accent: false },
  { icon: '🔐', title: 'Staff Login', sub: 'Admin / Security', route: 'Login' as const, accent: false },
  { icon: '📷', title: 'Scan QR Code', sub: 'Scan to check-in/check-out', route: 'Scan' as const, accent: false },
];

export default function HomeScreen() {
  const nav = useNavigation<Nav>();

  return (
    <Screen centered>
      <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={styles.logo}><Text style={{ fontSize: 36 }}>🪪</Text></View>
          <Text style={styles.title}>Visitor Management System</Text>
        </View>

        <View style={{ gap: 12 }}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => nav.navigate(item.route as any)}
              activeOpacity={0.85}
              style={[styles.item, item.accent ? styles.accent : styles.normal]}
            >
              <View style={[styles.icon, item.accent ? styles.aIcon : styles.nIcon]}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.iTitle}>{item.title}</Text>
                <Text style={styles.iSub}>{item.sub}</Text>
              </View>
              <Text style={{ color: item.accent ? Colors.accent : Colors.muted, fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16,  resizeMode: 'contain'},
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: Colors.muted, marginTop: 4 },
  item: { padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  accent: { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  normal: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aIcon: { backgroundColor: 'rgba(245,158,11,0.2)' },
  nIcon: { backgroundColor: 'rgba(255,255,255,0.06)' },
  iTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  iSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
});
