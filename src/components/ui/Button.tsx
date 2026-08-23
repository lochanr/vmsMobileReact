import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
}

export default function Button({ label, onPress, loading, variant = 'primary' }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} style={[styles.btn, isPrimary ? styles.primary : styles.ghost]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : Colors.accent} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.pText : styles.gText]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  primary: { backgroundColor: Colors.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  text: { fontSize: 14, fontWeight: '600' },
  pText: { color: '#fff' },
  gText: { color: Colors.text },
});
