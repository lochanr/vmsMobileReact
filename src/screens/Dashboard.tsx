import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  RefreshControl,
  Image,
} from 'react-native';
import Screen from '../components/layout/Screen';
import Card from '../components/ui/Card';
import { api } from '../api/client';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Dashboard'>;

const ROLE_OPTIONS = ['admin', 'host', 'security', 'staff'];
const ROLE_FILTERS = ['All', 'Admin', 'Host', 'Security', 'Staff'];

interface VisitItem {
  id: number | string;
  visitor: number | string;
  company: number | string;
  department: number | string;
  user: number | string;
  purpose: string;
  tm_in: string;
  tm_out: string;
  status: string;
  badge?: string;
  otp?: string;
  entry_gate?: string;
  exit_gate?: string;
  vehicle_number?: string;
  vehicle_type?: string;
  visitorDetails?: {
    full_name?: string;
    name?: string;
    phone_number?: string;
    phone?: string;
    email?: string;
    photo_url?: string;
  };
}

interface UserItem {
  user_id?: string;
  id?: string;
  full_name?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  roles?: string | string[];
  department?: string | null;
  designation?: string | null;
  company?: string | number;
  status?: number;
}

export default function Dashboard() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'directory' | 'raw'>('overview');

  const nav = useNavigation<Nav>();
  const { data } = useRoute<Route>().params ?? { data: null };

  const user = data?.user;
  const currentUserId = user?.user_id ?? user?.id;
  const rawRole = user?.role || user?.roles;
  const userRole = (
    Array.isArray(rawRole)
      ? rawRole[0]
      : typeof rawRole === 'string'
        ? rawRole
        : 'user'
  ).toLowerCase();

  const isAdmin = userRole === 'admin';

  // Visits & Action State
  const [allVisits, setAllVisits] = useState<VisitItem[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [actionVisitId, setActionVisitId] = useState<number | string | null>(null);

  // Directory State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');

  // Modal States
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string; company_id?: number }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | 'NEW'>('NEW');

  // Forms State
  const [userForm, setUserForm] = useState({
    name: '',
    company: '1',
    department: '1',
    pswd: '',
    email: '',
    phone: '',
    gender: 'Male',
    dob: '2026-08-23',
    photo: 'string',
    roles: ['host'],
  });

  const [orgForm, setOrgForm] = useState({
    companyName: '',
    location: '',
    deptName: '',
  });

  // Fetch Visits & Enrich Visitor Data
  const fetchVisits = useCallback(async () => {
    try {
      setLoadingVisits(true);
      const res = await api.get('/visits');
      const rawVisits: VisitItem[] = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];

      // Filter visits matching logged in user ID
      const matchingVisits = rawVisits.filter(
        (v) => String(v.user) === String(currentUserId)
      );

      // Fetch visitor details dynamically
      const enrichedVisits = await Promise.all(
        matchingVisits.map(async (visit) => {
          if (!visit.visitor) return visit;
          try {
            const visitorRes = await api.get(`/visitors/${visit.visitor}`);
            return {
              ...visit,
              visitorDetails: visitorRes.data,
            };
          } catch {
            return visit;
          }
        })
      );

      setAllVisits(enrichedVisits);
    } catch (err) {
      console.error('Failed to fetch visits:', err);
    } finally {
      setLoadingVisits(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // Handle Approve Action
  const handleApproveVisit = async (visitId: number | string) => {
    setActionVisitId(visitId);
    try {
      await api.patch(`/visits/${visitId}/approve`, {
        remarks: 'Approved by Host',
      });
      Alert.alert('Success', 'Visit approved successfully!');
      fetchVisits();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to approve visit.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActionVisitId(null);
    }
  };

  // Handle Reject Action
  const handleRejectVisit = async (visitId: number | string) => {
    setActionVisitId(visitId);
    try {
      await api.patch(`/visits/${visitId}/reject`, {
        rejection_reason: 'Rejected by Host',
      });
      Alert.alert('Success', 'Visit request rejected.');
      fetchVisits();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to reject visit.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActionVisitId(null);
    }
  };

  const pendingVisits = useMemo(() => {
    return allVisits.filter((v) => v.status?.toLowerCase() === 'pending');
  }, [allVisits]);

  const historyVisits = useMemo(() => {
    return allVisits.filter((v) => v.status?.toLowerCase() !== 'pending');
  }, [allVisits]);

  // Fetch Directory Users
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/users');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setUsersList(res.data.data);
      } else if (Array.isArray(res.data)) {
        setUsersList(res.data);
      }
    } catch (err) {
      console.log('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchOrgData = async () => {
    try {
      const [compRes, deptRes] = await Promise.allSettled([
        api.get('/companies'),
        api.get('/departments'),
      ]);

      if (compRes.status === 'fulfilled') {
        setCompanies(compRes.value.data || []);
        if (compRes.value.data?.length > 0) {
          setSelectedCompanyId(compRes.value.data[0].id);
        }
      }

      if (deptRes.status === 'fulfilled') {
        setDepartments(deptRes.value.data || []);
      }
    } catch (e) {
      console.error('Failed to load org data', e);
    }
  };

  useEffect(() => {
    if (orgModalVisible) {
      fetchOrgData();
    }
  }, [orgModalVisible]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (refreshToken) {
        await api.post('/auth/token/logout', { refresh_token: refreshToken });
      }
    } catch (e) {
      console.log('Logout Error:', e);
    } finally {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user');
      setLoggingOut(false);
      nav.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.pswd || !userForm.phone) {
      Alert.alert('Validation Error', 'Please fill in Name, Email, Password, and Phone.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...userForm,
        company: parseInt(userForm.company, 10) || 1,
        department: parseInt(userForm.department, 10) || 1,
        roles: Array.isArray(userForm.roles) ? userForm.roles[0] : userForm.roles,
      };

      await api.post('/users', payload);
      Alert.alert('Success', `User account created successfully!`);

      setUserForm({
        name: '',
        company: '1',
        department: '1',
        pswd: '',
        email: '',
        phone: '',
        gender: 'Male',
        dob: '2026-08-23',
        photo: 'string',
        roles: ['host'],
      });
      setUserModalVisible(false);
      if (activeTab === 'directory') fetchUsers();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to create user.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCompanyAndDept = async () => {
    if (!orgForm.deptName.trim()) {
      return Alert.alert('Validation Error', 'Department Name is required.');
    }

    setSubmitting(true);
    try {
      let companyId = selectedCompanyId;

      if (selectedCompanyId === 'NEW') {
        if (!orgForm.companyName.trim()) {
          Alert.alert('Validation Error', 'Company Name is required when creating a new organization.');
          setSubmitting(false);
          return;
        }

        const compRes = await api.post('/companies', {
          name: orgForm.companyName,
          location: orgForm.location || 'Default',
        });
        companyId = compRes.data.id;
      }

      await api.post('/departments', {
        name: orgForm.deptName,
        company: companyId,
      });

      Alert.alert('Success', 'Organization / Department created successfully!');
      setOrgForm({ companyName: '', location: '', deptName: '' });
      setOrgModalVisible(false);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to save setup.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const uName = u.full_name || u.name || '';
      const uEmail = u.email || u.username || '';
      const uDept = u.department || '';

      const matchesSearch =
        uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        uEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        uDept.toLowerCase().includes(searchQuery.toLowerCase());

      const r = Array.isArray(u.roles) ? u.roles[0] : u.role || u.roles || '';
      const matchesRole =
        selectedRoleFilter === 'All' || r.toLowerCase() === selectedRoleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [usersList, searchQuery, selectedRoleFilter]);

  const renderVisitCard = (visit: VisitItem) => {
    const visitorName =
      visit.visitorDetails?.full_name || visit.visitorDetails?.name || `Visitor #${visit.visitor}`;
    const visitorPhone =
      visit.visitorDetails?.phone_number || visit.visitorDetails?.phone || 'No phone';
    const photoUrl = visit.visitorDetails?.photo_url;
    const isPending = visit.status?.toLowerCase() === 'pending';
    const isApproved = visit.status?.toLowerCase() === 'approved';
    const isActioning = actionVisitId === visit.id;

    return (
      <View key={visit.id} style={styles.visitCard}>
        <View style={styles.visitHeader}>
          <View style={styles.visitorMetaLeft}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.visitorAvatarImage} />
            ) : (
              <View style={styles.visitorAvatarPlaceholder}>
                <Text style={styles.visitorAvatarText}>
                  {visitorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.visitorName}>{visitorName}</Text>
              <Text style={styles.visitorSubText}>{visitorPhone}</Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              isPending && styles.statusPending,
              isApproved && styles.statusApproved,
              !isPending && !isApproved && styles.statusRejected,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPending && styles.statusPendingText,
                isApproved && styles.statusApprovedText,
                !isPending && !isApproved && styles.statusRejectedText,
              ]}
            >
              {visit.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.visitDetailsGrid}>
          <View style={styles.visitDetailItem}>
            <Text style={styles.detailLabel}>Purpose</Text>
            <Text style={styles.detailValue}>{visit.purpose || 'N/A'}</Text>
          </View>
          <View style={styles.visitDetailItem}>
            <Text style={styles.detailLabel}>Gate</Text>
            <Text style={styles.detailValue}>{visit.entry_gate || 'Main Gate'}</Text>
          </View>
          <View style={styles.visitDetailItem}>
            <Text style={styles.detailLabel}>Check In</Text>
            <Text style={styles.detailValue}>
              {visit.tm_in ? new Date(visit.tm_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </Text>
          </View>
          <View style={styles.visitDetailItem}>
            <Text style={styles.detailLabel}>Check Out</Text>
            <Text style={styles.detailValue}>
              {visit.tm_out ? new Date(visit.tm_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Action Controls for Pending Items */}
        {isPending && (
          <View style={styles.actionButtonRow}>
            {isActioning ? (
              <ActivityIndicator color="#0A84FF" style={{ width: '100%', marginVertical: 8 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.decisionBtn, styles.approveBtn]}
                  onPress={() => handleApproveVisit(visit.id)}
                >
                  <Text style={styles.decisionBtnText}>✓ Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.decisionBtn, styles.rejectBtn]}
                  onPress={() => handleRejectVisit(visit.id)}
                >
                  <Text style={styles.decisionBtnText}>✕ Reject</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.userName}>{user?.name || 'User Account'}'s Dashboard</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} disabled={loggingOut}>
            <Text style={styles.logoutText}>{loggingOut ? 'Signing Out...' : 'Sign Out'}</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Switcher */}
        <View style={styles.segmentedTabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.activeTabBtn]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.activeTabBtnText]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.activeTabBtn]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.activeTabBtnText]}>
              History ({historyVisits.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'directory' && styles.activeTabBtn]}
            onPress={() => setActiveTab('directory')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'directory' && styles.activeTabBtnText]}>
              Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'raw' && styles.activeTabBtn]}
            onPress={() => setActiveTab('raw')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'raw' && styles.activeTabBtnText]}>
              Session Data
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVisits(); }} />}
          >
            {/* PENDING VISITS SECTION */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeaderTitle}>Pending Visit Requests ({pendingVisits.length})</Text>
              {loadingVisits ? (
                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 12 }} />
              ) : pendingVisits.length > 0 ? (
                pendingVisits.map(renderVisitCard)
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No pending visit requests found.</Text>
                </View>
              )}
            </View>

            {/* ADMIN ACTIONS */}
            {isAdmin && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeaderTitle}>Management Actions</Text>
                <View style={styles.adminActionRow}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setUserModalVisible(true)}>
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                      <Text style={[styles.actionIconText, { color: '#0A84FF' }]}>+</Text>
                    </View>
                    <View style={styles.actionCardBody}>
                      <Text style={styles.actionTitle}>Add User / Host</Text>
                      <Text style={styles.actionSub}>Create new profile</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionCard} onPress={() => setOrgModalVisible(true)}>
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                      <Text style={[styles.actionIconText, { color: '#30D158' }]}>+</Text>
                    </View>
                    <View style={styles.actionCardBody}>
                      <Text style={styles.actionTitle}>Add Org / Dept</Text>
                      <Text style={styles.actionSub}>Setup company entity</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* PROFILE DETAILS */}
            <Text style={styles.sectionHeaderTitle}>Active User Details</Text>
            <Card style={styles.profileCard}>
              <View style={styles.profileCardHeader}>
                <View style={styles.badgeRole}>
                  <Text style={styles.badgeRoleText}>{userRole.toUpperCase()}</Text>
                </View>
                <View style={styles.statusPill}>
                  <View style={[styles.statusDot, { backgroundColor: user?.status === 1 ? '#30D158' : '#FF453A' }]} />
                  <Text style={styles.statusText}>{user?.status === 1 ? 'Active Session' : 'Inactive'}</Text>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoTile}>
                  <Text style={styles.tileLabel}>Account ID</Text>
                  <Text style={styles.tileValue}>{currentUserId ?? 'N/A'}</Text>
                </View>
                <View style={styles.infoTile}>
                  <Text style={styles.tileLabel}>Email</Text>
                  <Text style={styles.tileValue}>{user?.email ?? 'N/A'}</Text>
                </View>
              </View>
            </Card>
          </ScrollView>
        )}

        {/* TAB 2: VISITOR HISTORY */}
        {activeTab === 'history' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVisits(); }} />}
          >
            <Text style={styles.sectionHeaderTitle}>Completed & Processed Visits</Text>
            {loadingVisits ? (
              <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 20 }} />
            ) : historyVisits.length > 0 ? (
              historyVisits.map(renderVisitCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No visit history recorded yet.</Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* TAB 3: DIRECTORY */}
        {activeTab === 'directory' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBarContainer}>
              <TextInput
                style={styles.searchBar}
                placeholder="Search by name, email, department..."
                placeholderTextColor="#7C7C80"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsRow}>
              {ROLE_FILTERS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterChip, selectedRoleFilter === r && styles.filterChipActive]}
                  onPress={() => setSelectedRoleFilter(r)}
                >
                  <Text style={[styles.filterChipText, selectedRoleFilter === r && styles.filterChipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingUsers ? (
              <View style={styles.centeredLoader}>
                <ActivityIndicator size="large" color="#0A84FF" />
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item, index) => item.user_id || item.id || index.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={{ color: '#7C7C80', fontSize: 14 }}>No accounts match the current filter.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const name = item.full_name || item.name || 'User';
                  const email = item.email || item.username || 'No email provided';
                  const roleStr = (Array.isArray(item.roles) ? item.roles[0] : item.role || 'user').toUpperCase();

                  return (
                    <View style={styles.directoryCard}>
                      <View style={styles.dirAvatar}>
                        <Text style={styles.dirAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.dirName}>{name}</Text>
                          <View style={styles.dirBadge}>
                            <Text style={styles.dirBadgeText}>{roleStr}</Text>
                          </View>
                        </View>
                        <Text style={styles.dirEmail}>{email}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* TAB 4: RAW PAYLOAD */}
        {activeTab === 'raw' && (
          <ScrollView style={styles.codeBlockContainer}>
            <Text style={styles.codeText}>{JSON.stringify(data, null, 2)}</Text>
          </ScrollView>
        )}
      </View>

      {/* MODALS */}
      <Modal visible={userModalVisible} animationType="fade" transparent onRequestClose={() => setUserModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add System Account</Text>
            <ScrollView style={{ width: '100%', maxHeight: 380 }}>
              <TextInput style={styles.input} placeholder="Full Name *" placeholderTextColor="#7C7C80" value={userForm.name} onChangeText={(v) => setUserForm({ ...userForm, name: v })} />
              <TextInput style={styles.input} placeholder="Email *" placeholderTextColor="#7C7C80" keyboardType="email-address" autoCapitalize="none" value={userForm.email} onChangeText={(v) => setUserForm({ ...userForm, email: v })} />
              <TextInput style={styles.input} placeholder="Password *" placeholderTextColor="#7C7C80" secureTextEntry value={userForm.pswd} onChangeText={(v) => setUserForm({ ...userForm, pswd: v })} />
              <TextInput style={styles.input} placeholder="Phone *" placeholderTextColor="#7C7C80" keyboardType="phone-pad" value={userForm.phone} onChangeText={(v) => setUserForm({ ...userForm, phone: v })} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setUserModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddUser} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Create Account</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={orgModalVisible} animationType="fade" transparent onRequestClose={() => setOrgModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Organization Unit</Text>
            <ScrollView style={{ width: '100%', maxHeight: 400 }}>
              <TextInput style={styles.input} placeholder="Department Name to Add *" placeholderTextColor="#7C7C80" value={orgForm.deptName} onChangeText={(v) => setOrgForm({ ...orgForm, deptName: v })} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOrgModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddCompanyAndDept} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Save Setup</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 8,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarHeaderText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  welcomeText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.25)',
  },
  logoutText: {
    color: '#FF453A',
    fontWeight: '600',
    fontSize: 12,
  },
  segmentedTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabBtnText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  visitCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  visitorMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitorAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  visitorAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  visitorAvatarText: {
    color: '#0A84FF',
    fontWeight: '700',
    fontSize: 16,
  },
  visitorName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  visitorSubText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
  },
  statusApproved: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  statusRejected: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPendingText: {
    color: '#FF9F0A',
  },
  statusApprovedText: {
    color: '#30D158',
  },
  statusRejectedText: {
    color: '#FF453A',
  },
  visitDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 10,
  },
  visitDetailItem: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    color: '#8E8E93',
    fontSize: 10,
    marginBottom: 2,
  },
  detailValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  decisionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: '#30D158',
  },
  rejectBtn: {
    backgroundColor: '#FF453A',
  },
  decisionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyCardText: {
    color: '#8E8E93',
    fontSize: 13,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionCardBody: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionSub: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  badgeRole: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRoleText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoTile: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  tileLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  searchBarContainer: {
    marginBottom: 10,
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillsRow: {
    flexDirection: 'row',
    marginBottom: 14,
    maxHeight: 32,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0A84FF',
  },
  filterChipText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  directoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dirAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dirAvatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  dirName: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  dirEmail: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  dirBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dirBadgeText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
  },
  centeredLoader: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  codeBlockContainer: {
    backgroundColor: '#121214',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flex: 1,
  },
  codeText: {
    color: '#30D158',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#FFF',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 13,
  },
  submitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});