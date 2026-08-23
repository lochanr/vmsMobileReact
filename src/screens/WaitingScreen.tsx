import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/layout/Screen';
import { getVisitStatus } from '../api/services';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Waiting'>;

const STATUS: Record<string, { icon: string; label: string; sub: string; color: string }> = {
  pending: { icon: '⏳', label: 'Waiting for Approval', sub: 'Your request has been submitted to the host.', color: Colors.accent },
  approved: { icon: '✅', label: 'Approved!', sub: 'Redirecting to your pass...', color: Colors.success },
  rejected: { icon: '❌', label: 'Request Rejected', sub: 'Your request was not approved. Contact reception.', color: Colors.danger },
  checked_in: { icon: '🏢', label: 'Checked In', sub: 'Entry recorded.', color: Colors.indigo },
};

export default function WaitingScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const visitId = route.params?.visitId;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!visitId) {
      setError('Invalid Visit ID');
      return;
    }

    const poll = async () => {
      try {
        const v = await getVisitStatus(String(visitId));
        
        // Safely extract status from response
        const rawStatus = v?.status || v?.data?.status || 'PENDING';
        const currentStatus = String(rawStatus).toLowerCase();

        setStatus(currentStatus);
        setError('');

        if (currentStatus === 'approved') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Navigate to Pass screen once approved
          nav.replace('Pass', { visitId });
        } else if (currentStatus === 'rejected') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err: any) {
        console.error('Polling error:', err?.response?.data || err?.message);
        const errMsg = err?.response?.data?.detail || 'Could not reach server.';
        setError(typeof errMsg === 'string' ? errMsg : 'Could not reach server.');
      }
    };

    // Run initial poll immediately
    poll();

    // Poll every 3 seconds
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visitId, nav]);

  const cfg = STATUS[status] || STATUS.pending;

  return (
    <Screen centered>
      <View style={styles.container}>
        <View style={[styles.box, { backgroundColor: `${cfg.color}10`, borderColor: `${cfg.color}30` }]}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>{cfg.icon}</Text>
          <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.sub}>{cfg.sub}</Text>

          {error ? (
            <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 16, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}

          {status === 'pending' && !error && (
            <View style={styles.checkingRow}>
              <ActivityIndicator color={Colors.accent} size="small" />
              <Text style={styles.checkingText}>CHECKING STATUS EVERY 3s</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => nav.replace('Home')} style={{ marginTop: 20 }}>
          <Text style={{ color: Colors.muted, fontSize: 14 }}>← Return to Home</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 340, alignSelf: 'center', alignItems: 'center' },
  box: { width: '100%', padding: 32, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  label: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  checkingText: { fontSize: 11, color: Colors.muted, fontFamily: 'monospace', letterSpacing: 1 },
});