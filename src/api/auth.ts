import { api } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  await AsyncStorage.setItem('access_token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  return data;
};

export const logout = async () => {
  try {
    // Retrieve stored refresh token
    const refreshToken = await AsyncStorage.getItem('refresh_token');

    if (refreshToken) {
      // Call backend logout endpoint
      await api.post('/vms/auth/token/logout', {
        refresh_token: refreshToken,
      });
    }
  } catch (error) {
    console.error('Logout API Error:', error);
  } finally {
    // Always clear storage and end local session
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('session_token');
    await AsyncStorage.removeItem('user');
  }
};

export const changePassword = async (old: string, newP: string, userId: number) => {
  return api.post(`/auth/change-password?current_user_id=${userId}`, { old_password: old, new_password: newP });
};
