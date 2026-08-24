import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import StatusBadge from '../components/ui/StatusBadge';
import { getVisitStatus } from '../api/services';
import { api } from '../api/client';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Pass'>;

export default function PassScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const visitId = route.params?.visitId;

  const [visit, setVisit] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Lookup Maps
  const [companiesMap, setCompaniesMap] = useState<Record<string | number, string>>({});
  const [departmentsMap, setDepartmentsMap] = useState<Record<string | number, string>>({});

  useEffect(() => {
    if (!visitId) {
      setError('Invalid Visit ID');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch visit data, companies list, and departments list concurrently
        const [visitRes, compRes, deptRes] = await Promise.allSettled([
          getVisitStatus(String(visitId)),
          api.get('/companies'),
          api.get('/departments'),
        ]);

        // Build Company ID -> Name map
        if (compRes.status === 'fulfilled' && Array.isArray(compRes.value.data)) {
          const cMap: Record<string | number, string> = {};
          compRes.value.data.forEach((c: any) => {
            cMap[c.id] = c.name;
          });
          setCompaniesMap(cMap);
        }

        // Build Department ID -> Name map
        if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value.data)) {
          const dMap: Record<string | number, string> = {};
          deptRes.value.data.forEach((d: any) => {
            dMap[d.id] = d.name;
          });
          setDepartmentsMap(dMap);
        }

        // Handle Visit Data
        if (visitRes.status === 'fulfilled' && visitRes.value) {
          setVisit(visitRes.value);
        } else {
          setError('Pass details empty');
        }
      } catch (err) {
        console.log('Error loading pass:', err);
        setError('Pass not found');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [visitId]);

  if (loading) {
    return (
      <LinearGradient colors={['#0f172a', '#080c14']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  if (error || !visit) {
    return (
      <LinearGradient colors={['#0f172a', '#080c14']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>❌</Text>
        <Text style={{ color: Colors.danger, fontWeight: '800', fontSize: 18 }}>Pass Not Found</Text>
        <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 4 }}>ID: {visitId || 'N/A'}</Text>
        <TouchableOpacity onPress={() => nav.replace('Home')} style={{ marginTop: 24 }}>
          <Text style={{ color: Colors.accent, fontWeight: '600' }}>← Go Home</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Value mappings using lookups
  const idToDisplay = visit.visit_id || visit.id || visitId;
  const visitorName = visit.visitor_name || visit.full_name || visit.name || 'Visitor';

  // Resolve raw ID or Name string to human-readable text
  const resolvedCompany =
    companiesMap[visit.company] || visit.company_name || visit.organisation || visit.company || 'N/A';
  const resolvedDepartment =
    departmentsMap[visit.department] || visit.department_name || visit.department || 'N/A';

  const purpose = visit.purpose || 'Meeting';
  const phone = visit.phone_number || visit.phone || 'N/A';
  const status = visit.status || 'APPROVED';
  const photoUrl = visit.photo_url || visit.photo;
  const createdAt = visit.created_at || visit.tm_cr;

  // QR Code Payload
  const qrData = JSON.stringify({
    visit_id: idToDisplay,
    phone_number: phone,
    visitor_name: visitorName,
  });

  return (
    <LinearGradient colors={['#0f172a', '#080c14']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <View style={styles.card}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.header}>VISITOR PASS</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{visitorName}</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{resolvedCompany}</Text>
                </View>
                {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} /> : null}
              </View>
            </LinearGradient>

            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {[
                  ['Company', String(resolvedCompany)],
                  ['Department', String(resolvedDepartment)],
                  ['Purpose', String(purpose)],
                  ['Phone', String(phone)],
                  ['Date', createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detail}>
                    <Text style={styles.dLabel}>{label?.toUpperCase()}</Text>
                    <Text style={styles.dValue}>{value}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <StatusBadge status={status} />
              </View>

              <View style={styles.qrBox}>
                <QRCode value={qrData} size={100} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrLabel}>SCAN AT KIOSK TO CHECK-IN / CHECK-OUT</Text>
              
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={() => nav.replace('Home')} style={styles.homeBtn}>
            <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 14 }}>🏠 Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  header: { fontSize: 10, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 6 },
  photo: { width: 60, height: 60, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(245,158,11,0.4)' },
  detail: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, minWidth: '45%', flex: 1 },
  dLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  dValue: { fontSize: 12, color: '#1e293b', fontWeight: '600' },
  qrBox: { borderTopWidth: 1, borderTopColor: '#e2e8f0', borderStyle: 'dashed', paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  qrLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  qrId: { fontFamily: 'monospace', fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  homeBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, alignItems: 'center' },
});