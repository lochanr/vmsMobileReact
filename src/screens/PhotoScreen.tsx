import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Button from '../components/ui/Button';
import { useVisitorStore } from '../store/useVisitorStore';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PhotoScreen() {
  const nav = useNavigation<Nav>();
  const { returningVisitor, setPhoto, photoUri } = useVisitorStore();
  const [captured, setCaptured] = useState(false);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera to take visitor photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleCapture = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
      return;
    }

    launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.7 }, (res) => {
      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert('Error', res.errorMessage || 'Camera failed');
        return;
      }
      const asset = res.assets?.[0];
      if (asset?.uri && asset.base64) {
        setPhoto(asset.uri, `data:image/jpeg;base64,${asset.base64}`);
        setCaptured(true);
      }
    });
  };

  const handleUsePrevious = () => {
    if (returningVisitor) {
      setPhoto('previous', returningVisitor.photo);
      nav.navigate('Details');
    }
  };

  const handleNext = () => nav.navigate('Details');
  const handleRetake = () => setCaptured(false);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ position: 'absolute', top: 56, left: 24, zIndex: 10 }}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: Colors.muted, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={{ position: 'absolute', top: 100, left: 0, right: 0, zIndex: 10, alignItems: 'center' }}>
        <Text style={styles.step}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Visitor Photo</Text>
        {returningVisitor && !captured && (
          <Text style={{ color: Colors.success, fontSize: 12, marginTop: 4 }}>👋 Welcome back, {returningVisitor.name}!</Text>
        )}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={styles.cameraBox}>
          {captured && photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : returningVisitor && !captured ? (
            <Image source={{ uri: returningVisitor.photo }} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 40, color: Colors.muted }}>📷</Text>
              <Text style={{ color: Colors.muted, marginTop: 8, fontSize: 13 }}>Tap below to open camera</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ padding: 24, gap: 12, paddingBottom: 48 }}>
        {captured ? (
          <>
            <Button label="Continue →" onPress={handleNext} />
            <Button label="↺ Retake" onPress={handleRetake} variant="ghost" />
          </>
        ) : returningVisitor ? (
          <>
            <Button label="Use Previous Photo" onPress={handleUsePrevious} />
            <Button label="📷 Take New Photo" onPress={handleCapture} variant="ghost" />
          </>
        ) : (
          <Button label="📸 Open Camera" onPress={handleCapture} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 11, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  cameraBox: { width: 240, height: 240, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: Colors.accent },
});