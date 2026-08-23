import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your development server's IP address
// Use 'http://10.0.2.2:8006/api/v1' for Android Emulator
// Use 'http://192.168.0.102:8006/api/v1' for Physical Device
export const API_URL = 'http://192.168.0.117:8000/vms';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json', 
    },
});

// Attach Bearer token to all outgoing requests
api.interceptors.request.use(async (config) => {
  const isAuthEndpoint = config.url?.includes('/auth/session/login') || config.url?.includes('/auth/token/login');

  if (!isAuthEndpoint) {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  console.log('📤 REQUEST:', config.method?.toUpperCase(), `${config.baseURL}${config.url}`, config.data ?? '');
  return config;
});

// Handle global 401 Unauthorized errors (Automatic Logout)
api.interceptors.response.use(
  (res) => {
    console.log('📥 RESPONSE:', res.status, res.data);
    return res;
  },
  async (err) => {
    if (err.response?.status === 401) {
      console.log('🔒 Token expired or invalid. Clearing session...');
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user');
      // Optional: Dispatch a global navigation event to return to LoginScreen if needed
    }
    console.log('❌ ERROR:', err.response?.status, err.response?.data);
    return Promise.reject(err);
  }
);