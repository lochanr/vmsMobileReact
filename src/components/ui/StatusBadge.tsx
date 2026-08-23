import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

const MAP: Record<string, string> = {
  pending: Colors.accent,
  approved: Colors.success,
  checked_in: Colors.indigo,
  checked_out: Colors.slate,
  rejected: Colors.danger,
  cancelled: Colors.muted,
};

export default function StatusBadge({ status }: { status: string }) {
  const color = MAP[status.toLowerCase()] || Colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
      <Text style={[styles.text, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});
