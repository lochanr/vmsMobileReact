import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../../constants/colors';

interface InputProps extends TextInputProps {
  label: string;
}

export default function Input({ label, style, ...props }: InputProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={Colors.muted} style={[styles.input, style]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, color: Colors.muted, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
  },
});
