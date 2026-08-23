import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api/client';
import Card from '../components/ui/Card.tsx';
import { Colors } from '../constants/colors';

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  roles: string | string[];
}

export default function UserList() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const renderUser = ({ item }: { item: UserItem }) => {
    const roleStr = Array.isArray(item.roles) ? item.roles[0] : item.roles;

    return (
      <View style={styles.userRow}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userSub}>{item.email} • {item.phone}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{(roleStr || 'USER').toUpperCase()}</Text>
        </View>
      </View>
    );
  };

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Users ({users.length})</Text>
        <TouchableOpacity onPress={fetchUsers} disabled={loading}>
          <Text style={styles.refreshBtn}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#007AFF" style={{ marginVertical: 12 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUser}
          scrollEnabled={false}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text ?? '#fff',
  },
  refreshBtn: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  userSub: {
    fontSize: 12,
    color: Colors.muted ?? '#aaa',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roleText: {
    color: '#007AFF',
    fontSize: 11,
    fontWeight: '700',
  },
});