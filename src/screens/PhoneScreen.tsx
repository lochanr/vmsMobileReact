import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../components/layout/Screen';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useVisitorStore } from '../store/useVisitorStore';
import { api, API_URL } from '../api/client';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Base domain without /vms path suffix for static file check
const BASE_DOMAIN = API_URL.replace(/\/vms\/?$/, '');

export default function PhoneScreen() {
  const nav = useNavigation<Nav>();
  const { setPhone, setEmail, setReturningVisitor, reset } = useVisitorStore();
  
  const [phone, setPhoneLocal] = useState('');
  const [email, setEmailLocal] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.trim()) return Alert.alert('Error', 'Enter phone number');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Alert.alert('Error', 'Enter a valid email');
    }

    setLoading(true);
    try {
      await api.post('/otp/send', { email, phone });
      setOtpSent(true);
      Alert.alert('Success', `OTP sent to ${email}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to send OTP';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) {
      return Alert.alert('Error', 'Please enter a valid OTP');
    }

    setLoading(true);
    try {
      await api.post('/otp/verify', { email, otp });

      setPhone(phone);
      setEmail(email);

      // Search DB for existing visitor profile
      try {
        const searchRes = await api.get(`/visitors/search?phone=${encodeURIComponent(phone.trim())}`);
        const visitorData = searchRes.data;

        if (visitorData) {
          const rawPhoto = visitorData.photo || visitorData.photo_path;

          // Check if photo exists and is not default
          if (rawPhoto && !rawPhoto.includes('default.jpg')) {
            const photoUrl = rawPhoto.startsWith('http') ? rawPhoto : `${BASE_DOMAIN}${rawPhoto.startsWith('/') ? '' : '/'}${rawPhoto}`;
            
            try {
              // Verify image file exists on server
              const imgCheck = await fetch(photoUrl, { method: 'HEAD' });
              if (!imgCheck.ok) {
                // If 404/file missing on server, set photo to null
                visitorData.photo = null;
              }
            } catch {
              visitorData.photo = null;
            }
          }

          setReturningVisitor(visitorData);
        } else {
          setReturningVisitor(null);
        }
      } catch {
        setReturningVisitor(null);
      }

      nav.navigate('Photo');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Invalid or expired OTP';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <TouchableOpacity onPress={() => { reset(); nav.goBack(); }} style={{ marginBottom: 28 }}>
        <Text style={{ color: Colors.muted, fontSize: 14 }}>← Back</Text>
      </TouchableOpacity>

      <View style={{ marginBottom: 28 }}>
        <Text style={styles.step}>STEP 1 OF 3</Text>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.sub}>
          {otpSent ? `Enter the verification code sent to ${email}` : 'Enter your phone and email to continue'}
        </Text>
      </View>

      <Card>
        {!otpSent ? (
          <>
            <Input 
              label="Phone Number *" 
              value={phone} 
              onChangeText={setPhoneLocal} 
              placeholder="+91 98765 43210" 
              keyboardType="phone-pad" 
            />
            <Input 
              label="Email Address *" 
              value={email} 
              onChangeText={setEmailLocal} 
              placeholder="you@example.com" 
              keyboardType="email-address" 
              autoCapitalize="none" 
            />
            <Button 
              label={loading ? 'Sending OTP...' : 'Send OTP →'} 
              onPress={handleSendOtp} 
              loading={loading}
            />
          </>
        ) : (
          <>
            <Input 
              label="Enter OTP *" 
              value={otp} 
              onChangeText={setOtp} 
              placeholder="123456" 
              keyboardType="number-pad" 
              maxLength={6}
            />
            <Button 
              label={loading ? 'Verifying...' : 'Verify & Continue →'} 
              onPress={handleVerifyOtp} 
              loading={loading}
            />
            <TouchableOpacity onPress={() => setOtpSent(false)} style={styles.resendBtn}>
              <Text style={styles.resendText}>Change Email / Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 11, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub: { fontSize: 14, color: Colors.muted },
  resendBtn: { marginTop: 16, alignItems: 'center' },
  resendText: { color: Colors.accent, fontSize: 13, textDecorationLine: 'underline' },
});