import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getVisitors, getVisits } from '../api/services';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RecoverScreen() {
  const nav = useNavigation<Nav>();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecover = async () => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanPhone && !cleanEmail) {
      return Alert.alert('Input Required', 'Please enter either your phone number or email address.');
    }

    setLoading(true);

    try {
      // Step 1: Fetch visitors and find matching record
      const visitors = await getVisitors();
      const visitor = visitors.find((v: any) => {
        const vPhone = v.phone || v.phone_number || '';
        const vEmail = (v.email || '').toLowerCase();

        const matchPhone = cleanPhone && vPhone.replace(/\D/g, '').endsWith(cleanPhone.replace(/\D/g, ''));
        const matchEmail = cleanEmail && vEmail === cleanEmail;

        return matchPhone || matchEmail;
      });

      if (!visitor) {
        Alert.alert('Not Found', 'No visitor found matching the provided details.');
        setLoading(false);
        return;
      }

      // Step 2: Fetch all visits from GET /vms/visits
      const visits = await getVisits();

      // Step 3: Filter passes matching visitor ID and allowed statuses (pending/approved)
      const visitorId = visitor.id || visitor.id;
      const validStatuses = ['approved', 'pending'];

      const userVisits = visits
        .filter((v: any) => {
          const isMatchVisitor = v.visitor === visitorId;
          const isMatchStatus = validStatuses.includes((v.status || '').toLowerCase());
          return isMatchVisitor && isMatchStatus;
        })
        .sort((a: any, b: any) => new Date(b.tm_cr).getTime() - new Date(a.tm_cr).getTime());

      if (!userVisits || userVisits.length === 0) {
        Alert.alert('No Pass Found', 'No active or pending visitor pass was found for this account.');
        setLoading(false);
        return;
      }

      // Get the most recent pass
      const activeVisit = userVisits[0];
      const visitId = activeVisit.id || activeVisit.id;

      // Step 4: Navigate to Pass Screen or Waiting Screen based on status
      if ((activeVisit.status || '').toLowerCase() === 'pending') {
        nav.replace('Waiting', { visitId });
      } else {
        nav.replace('Pass', { visitId });
      }
    } catch (error: any) {
      console.error('Pass Recovery Error:', error);
      const msg = error?.response?.data?.detail || error?.message || 'Failed to recover pass';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#080c14']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <TouchableOpacity onPress={() => nav.goBack()} style={{ marginBottom: 28 }}>
            <Text style={{ color: Colors.muted, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 28 }}>
            <Text style={styles.step}>RECOVER PASS</Text>
            <Text style={styles.title}>Enter your details</Text>
            <Text style={styles.sub}>Lookup your active or pending visitor pass</Text>
          </View>

          <Card>
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              label={loading ? 'Searching...' : 'Recover My Pass →'}
              onPress={handleRecover}
              loading={loading}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 11, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.muted },
});