import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import Screen from '../components/layout/Screen';
import { Colors } from '../constants/colors';
import { api } from '../api/client';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ScanApiResponse {
  message: string;
  visit_id: string;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | string;
  timestamp: string;
}

export default function ScanScreen() {
  const nav = useNavigation<Nav>();

  // Vision Camera Setup
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isPermissionChecked, setIsPermissionChecked] = useState<boolean>(false);
  const [permissionRequesting, setPermissionRequesting] = useState<boolean>(false);

  const [scanned, setScanned] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Result Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request Camera Permissions on Mount
  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        setPermissionRequesting(true);
        await requestPermission();
      }
      setIsPermissionChecked(true);
      setPermissionRequesting(false);
    })();
  }, [hasPermission, requestPermission]);

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleRetryPermission = async () => {
    setPermissionRequesting(true);
    await requestPermission();
    setPermissionRequesting(false);
    setIsPermissionChecked(true);
  };

  // Process API Scan Endpoint
  // Replace your existing handleScanData function with this:

  const handleScanData = async (rawValue: string) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);
    setErrorMessage(null);
    setScanResult(null);

    try {
      // Send full raw JSON string to backend as qr_payload
      const response = await api.post('/visits/scan', { 
        qr_payload: rawValue 
      });
      
      setScanResult(response.data);
      setModalVisible(true);
    } catch (error: any) {
      const errorDetail =
        error?.response?.data?.detail ||
        'Failed to process scan. Please try scanning again.';
      setErrorMessage(
        typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail)
      );
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  // Barcode output for Vision Camera v5
  const barcodeScanner = useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: (barcodes) => {
      const firstBarcode = barcodes?.[0];
      const rawValue = firstBarcode?.rawValue;
      if (rawValue && !scanned && !loading) {
        handleScanData(rawValue);
      }
    },
    onError: (error) => {
      console.warn('Barcode scan error:', error);
    },
  });

  // Reset Scanner State for Next Visitor
  const handleScanNext = () => {
    setModalVisible(false);
    setScanResult(null);
    setErrorMessage(null);
    setScanned(false);
  };

  if (!isPermissionChecked) {
    return (
      <Screen scroll={false}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.infoText}>Checking camera permissions...</Text>
        </View>
      </Screen>
    );
  }

  if (!hasPermission || !device) {
    return (
      <Screen scroll={false}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorHeader}>Camera Unavailable</Text>
          <Text style={styles.infoText}>
            {!hasPermission
              ? 'Camera permission was denied. Allow access in the app settings to scan visitor QR codes.'
              : 'No back camera device was found on this hardware.'}
          </Text>

          {!hasPermission && (
            <View style={{ width: '100%', maxWidth: 300, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.backBtn, { marginBottom: 10, width: '100%' }]}
                onPress={handleRetryPermission}
                disabled={permissionRequesting}
              >
                <Text style={styles.backBtnText}>
                  {permissionRequesting ? 'Requesting...' : 'Allow Camera'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.backBtn, { width: '100%', backgroundColor: 'rgba(0,122,255,0.15)' }]}
                onPress={handleOpenSettings}
              >
                <Text style={styles.backBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[styles.backBtn, { marginTop: 18 }]} onPress={() => nav.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Visitor QR</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Camera View Finder */}
        <View style={styles.cameraContainer}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!scanned}
            outputs={[barcodeScanner]}
          />

          {/* Scanner Overlay Frame */}
          <View style={styles.overlay}>
            <View style={styles.unfocusedContainer} />
            <View style={styles.middleRow}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.focusedContainer}>
                {loading && <ActivityIndicator size="large" color="#007AFF" />}
              </View>
              <View style={styles.unfocusedContainer} />
            </View>
            <View style={styles.unfocusedContainer} />
          </View>
        </View>

        <Text style={styles.instructionText}>
          Position the QR code within the frame.
        </Text>

        {/* Response / Error Feedback Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleScanNext}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {scanResult ? (
                <View style={styles.resultContainer}>
                  <View
                    style={[
                      styles.iconCircle,
                      scanResult.status === 'CHECKED_IN'
                        ? styles.checkInIcon
                        : styles.checkOutIcon,
                    ]}
                  >
                    <Text style={styles.iconText}>
                      {scanResult.status === 'CHECKED_IN' ? '✓' : '➔'}
                    </Text>
                  </View>

                  <Text style={styles.resultTitle}>
                    {scanResult.status === 'CHECKED_IN'
                      ? 'Check-In Successful'
                      : 'Check-Out Successful'}
                  </Text>

                  <Text style={styles.resultMessage}>{scanResult.message}</Text>

                  <View style={styles.detailBox}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Visit ID:</Text>
                      <Text style={styles.detailValue}>{scanResult.visit_id}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <Text
                        style={[
                          styles.statusBadgeText,
                          scanResult.status === 'CHECKED_IN'
                            ? styles.textGreen
                            : styles.textBlue,
                        ]}
                      >
                        {scanResult.status}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Time:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(scanResult.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.resultContainer}>
                  <View style={[styles.iconCircle, styles.errorIcon]}>
                    <Text style={styles.iconText}>✕</Text>
                  </View>

                  <Text style={styles.errorTitle}>Scan Rejected</Text>
                  <Text style={styles.errorMessage}>
                    {errorMessage || 'Unable to scan QR code.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={handleScanNext}>
                <Text style={styles.actionButtonText}>Scan Next Visitor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text ?? '#fff' },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  backBtnText: { color: Colors.text ?? '#fff', fontWeight: '600', fontSize: 13 },
  cameraContainer: {
    width: '100%',
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 230,
  },
  focusedContainer: {
    width: 230,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    textAlign: 'center',
    color: Colors.muted ?? '#aaa',
    fontSize: 13,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  infoText: { color: Colors.muted ?? '#aaa', marginTop: 12, textAlign: 'center' },
  errorHeader: { fontSize: 20, fontWeight: 'bold', color: '#ff4d4d', marginBottom: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  resultContainer: { width: '100%', alignItems: 'center' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkInIcon: { backgroundColor: 'rgba(52, 199, 89, 0.2)' },
  checkOutIcon: { backgroundColor: 'rgba(0, 122, 255, 0.2)' },
  errorIcon: { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
  iconText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  resultTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  resultMessage: { fontSize: 14, color: '#aaa', textAlign: 'center', marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '800', color: '#ff4d4d', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#ccc', textAlign: 'center', marginBottom: 20 },
  detailBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  detailLabel: { color: '#888', fontSize: 13 },
  detailValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statusBadgeText: { fontSize: 13, fontWeight: '800' },
  textGreen: { color: '#34C759' },
  textBlue: { color: '#007AFF' },
  actionButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});