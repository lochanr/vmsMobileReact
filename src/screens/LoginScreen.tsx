import { useState } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/layout/Screen';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { getFcmToken } from '../api/fcm';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return Alert.alert('Error', 'Enter email and password');
    }
    setLoading(true);

    try {
      // 1. Get Firebase Cloud Messaging (FCM) token
      const fcm = await getFcmToken();

      // 2. Build payload matching backend expectations
      const payload = {
        email: username.trim(),
        password: password,
        firetoken: fcm ?? ''
      };

      // 3. Call both API endpoints concurrently
      const [sessionRes, tokenRes] = await Promise.all([
        api.post('/auth/session/login', payload),
        api.post('/auth/token/login', payload)
      ]);

      const sessionData = sessionRes.data;
      const tokenData = tokenRes.data;

      // 4. Save session token, JWT access/refresh tokens, and user profile to storage
      if (sessionData.session_token) {
        await AsyncStorage.setItem('session_token', sessionData.session_token);
      }
      if (tokenData.access_token) {
        await AsyncStorage.setItem('access_token', tokenData.access_token);
      }
      if (tokenData.refresh_token) {
        await AsyncStorage.setItem('refresh_token', tokenData.refresh_token);
      }
      if (sessionData.user) {
        await AsyncStorage.setItem('user', JSON.stringify(sessionData.user));
      }

      // 5. Navigate to Dashboard with session data
      nav.replace('Dashboard', { data: sessionData });
    } catch (e: any) {
      console.log('Login error:', e.response?.status, e.response?.data || e.message);
      const body = e.response?.data || e.message;
      const msg = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      Alert.alert('Login Error', msg.slice(0, 500));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen centered>
      <View style={{ width: '100%', maxWidth: 360 }}>
        <TouchableOpacity onPress={() => nav.goBack()} style={{ marginBottom: 28 }}>
          <Text style={{ color: Colors.muted, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>
        <Text style={styles.title}>Staff Login</Text>

        <Card>
          <Input
            label="Email"
            value={username}
            onChangeText={setUsername}
            placeholder="lochan@test.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <Button
            label={loading ? 'Logging in...' : 'Login →'}
            onPress={handleLogin}
            loading={loading}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 28 },
  sub: { fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 28 },
});