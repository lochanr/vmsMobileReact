import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/layout/Screen';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import { getVisits, checkinVisit, checkoutVisit } from '../api/services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from '../api/auth';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { VisitResponse } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function StaffDashboard() {
  const nav = useNavigation<Nav>();
  const [visits, setVisits] = useState<VisitResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => u && setUser(JSON.parse(u)));
    loadVisits();
  }, []);

  const loadVisits = async () => {
    setRefreshing(true);
    try {
      const all = await getVisits();
      const filtered = user?.department ? all.filter((v) => v.department === user.department) : all;
      setVisits(filtered);
    } catch {
      Alert.alert('Error', 'Failed to load visits');
    }
    setRefreshing(false);
  };

  const handleCheckin = async (id: number) => {
    try {
      await checkinVisit(id, { badge: 'V-' + id, entry_gate: 'Main' });
      await loadVisits();
    } catch {
      Alert.alert('Error', 'Check-in failed');
    }
  };

  const handleCheckout = async (id: number) => {
    try {
      await checkoutVisit(id, { exit_gate: 'Main' });
      await loadVisits();
    } catch {
      Alert.alert('Error', 'Check-out failed');
    }
  };

  const handleLogout = async () => {
    await logout();
    nav.replace('Home');
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <View>
          <Text style={{ fontSize: 11, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2 }}>STAFF VIEW</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>My Visits</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={{ color: Colors.danger, fontSize: 13 }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadVisits} tintColor={Colors.accent} />}>
        {visits.length === 0 ? (
          <Text style={{ color: Colors.muted, textAlign: 'center', marginTop: 40 }}>No visits found</Text>
        ) : (
          visits.map((v) => (
            <View key={v.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontWeight: '700', fontSize: 15 }}>Visitor #{v.visitor}</Text>
                  <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>{v.purpose}</Text>
                  <Text style={{ color: Colors.muted, fontSize: 11, marginTop: 2 }}>{v.tm_in.slice(0, 16)}</Text>
                </View>
                <StatusBadge status={v.status} />
              </View>

              {v.status === 'approved' && (
                <View style={{ marginTop: 12 }}>
                  <Button label="Check In" onPress={() => handleCheckin(v.id)} />
                </View>
              )}
              {v.status === 'checked_in' && (
                <View style={{ marginTop: 12 }}>
                  <Button label="Check Out" onPress={() => handleCheckout(v.id)} />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 12 },
});
