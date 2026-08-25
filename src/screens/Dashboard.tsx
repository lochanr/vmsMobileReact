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

// Roles a company admin is allowed to hand out to their own staff.
// Admin & super_admin are managed through dedicated flows, not the generic "Add User" modal.
const STAFF_ROLE_OPTIONS = ['host', 'security', 'staff'];
const ROLE_FILTERS = ['All', 'Host', 'Security', 'Staff'];

type TabKey = 'overview' | 'history' | 'directory' | 'team' | 'organizations' | 'raw';

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

interface CompanyItem {
  id: number;
  name: string;
  location?: string;
}

interface DepartmentItem {
  id: number;
  name: string;
  company?: number | string;
  company_id?: number | string;
}


export default function Dashboard() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  //1. Add department state inside component

  const nav = useNavigation<Nav>();
  const { data } = useRoute<Route>().params ?? { data: null };

  const user = data?.user;
  const currentUserId = user?.user_id ?? user?.id;
  const currentUserCompanyId = user?.company ?? user?.company_id;
  const loggedInCompanyId = user?.company_id ?? user?.company;
  const rawRole = user?.role || user?.roles;
  const userRole = (
    Array.isArray(rawRole)
      ? rawRole[0]
      : typeof rawRole === 'string'
        ? rawRole
        : 'user'
  ).toLowerCase();

  // super_admin: platform-wide. Manages companies, their departments, and their admins.
  // admin: scoped to their own company. Manages that company's users + departments, approves that company's visits.
  const isSuperAdmin = userRole === 'super_admin';
  const isCompanyAdmin = userRole === 'admin';
  const canManageOrg = isSuperAdmin || isCompanyAdmin;

  

  // Tabs are role-specific: super_admin never touches visits, everyone else does.
  const tabs: { key: TabKey; label: string }[] = isSuperAdmin
    ? [
        { key: 'organizations', label: 'Organizations' },
        { key: 'raw', label: 'Session Data' },
      ]
    : isCompanyAdmin
      ? [
          { key: 'overview', label: 'Overview' },
          { key: 'history', label: 'History' },
          { key: 'team', label: 'Team' },
          { key: 'raw', label: 'Session Data' },
        ]
      : [
          { key: 'overview', label: 'Overview' },
          { key: 'history', label: 'History' },
          { key: 'directory', label: 'Directory' },
          { key: 'raw', label: 'Session Data' },
        ];

  // Keep activeTab valid whenever the role-derived tab set changes (e.g. after re-login as a different role).
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, isCompanyAdmin]);

  // Visits & Action State
  const [allVisits, setAllVisits] = useState<VisitItem[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [actionVisitId, setActionVisitId] = useState<number | string | null>(null);

  // Directory / Team State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Org State (companies / departments)
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [removingCompanyId, setRemovingCompanyId] = useState<number | null>(null);
  const [removingDeptId, setRemovingDeptId] = useState<number | null>(null);
  const [companyDepts, setCompanyDepts] = useState<DepartmentItem[]>([]);

  // Modal States
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Which company a new department / new admin should be attached to (super_admin picks; company admin is frozen).
  const [targetCompanyId, setTargetCompanyId] = useState<number | null>(null);

  

  // Forms State
  const [userForm, setUserForm] = useState({
    name: '',
    department: '',
    pswd: '',
    email: '',
    phone: '',
    gender: '',
    dob: '',
    photo: '',
    roles: '',
  });

  const [companyForm, setCompanyForm] = useState({ name: '', location: '' });
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    pswd: '',
    phone: '',
    department: '',
  });

  // Helper to resolve host name from user ID
  const getHostName = (userId: string | number) => {
    if (!userId) return 'N/A';
    const foundUser = usersList.find(
      (u) => String(u.user_id || u.id) === String(userId)
    );
    return foundUser?.full_name || foundUser?.name || foundUser?.username || `User #${userId}`;
  };

  const companyName = (companyId?: string | number) => {
    if (!companyId) return 'Unknown';
    return companies.find((c) => String(c.id) === String(companyId))?.name || `Company #${companyId}`;
  };

  const deptCompanyId = (d: DepartmentItem) => d.company ?? d.company_id;

  // Fetch Visits & Enrich Visitor Data
  const fetchVisits = useCallback(async () => {
    if (isSuperAdmin) return; // org-level role, not involved in visit approvals
    try {
      setLoadingVisits(true);
      const res = await api.get('/visits');
      const rawVisits: VisitItem[] = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];

      // Company admins see every visit for their company; individual users/hosts only see visits assigned to them.
      const matchingVisits = isCompanyAdmin
        ? rawVisits.filter((v) => String(v.company) === String(currentUserCompanyId))
        : rawVisits.filter((v) => String(v.user) === String(currentUserId));

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
  }, [currentUserId, currentUserCompanyId, isCompanyAdmin, isSuperAdmin]);

  // Fetch Users (scoped to own company for admins, global for super_admin)
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/users');
      const raw: UserItem[] = res.data?.data && Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      setUsersList(
        isCompanyAdmin
          ? raw.filter((u) => String(u.company) === String(currentUserCompanyId))
          : raw
      );
    } catch (err) {
      console.log('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  }, [isCompanyAdmin, currentUserCompanyId]);

  // Fetch Companies + Departments
  const fetchOrgData = useCallback(async () => {
    try {
      setLoadingOrg(true);
      const [compRes, deptRes] = await Promise.allSettled([
        api.get('/companies'),
        api.get('/departments'),
      ]);

      if (compRes.status === 'fulfilled') {
        const allCompanies: CompanyItem[] = compRes.value.data || [];
        setCompanies(
          isCompanyAdmin
            ? allCompanies.filter((c) => String(c.id) === String(currentUserCompanyId))
            : allCompanies
        );
      }

      if (deptRes.status === 'fulfilled') {
        const allDepts: DepartmentItem[] = deptRes.value.data || [];
        setDepartments(
          isCompanyAdmin
            ? allDepts.filter((d) => String(deptCompanyId(d)) === String(currentUserCompanyId))
            : allDepts
        );
      }
    } catch (e) {
      console.error('Failed to load org data', e);
    } finally {
      setLoadingOrg(false);
    }
  }, [isCompanyAdmin, currentUserCompanyId]);

  useEffect(() => {
    fetchVisits();
    fetchUsers();
    if (canManageOrg) fetchOrgData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchVisits, fetchUsers]);

  useEffect(() => {
    // Fetch data if currentUserCompanyId is ready or if team tab is active
    if (currentUserCompanyId) {
      fetchOrgData();
      fetchUsers();
    }
  }, [currentUserCompanyId, activeTab, fetchOrgData, fetchUsers]);

  useEffect(() => {
    if (adminModalVisible && targetCompanyId) {
      const fetchDepartments = async () => {
        setLoadingDepts(true);
        try {
          const res = await api.get('/departments');
          if (Array.isArray(res.data)) {
            // Filter departments matching targetCompanyId
            const filtered = res.data.filter(
              (d: DepartmentItem) => d.company === Number(targetCompanyId)
            );
            setDepartments(filtered);

            // Auto-select first department if available
            if (filtered.length > 0) {
              setAdminForm((prev) => ({ ...prev, department: String(filtered[0].id) }));
            } else {
              setAdminForm((prev) => ({ ...prev, department: '' }));
            }
          }
        } catch (err) {
          console.error('Failed to load departments', err);
        } finally {
          setLoadingDepts(false);
        }
      };
      fetchDepartments();
    }
  }, [adminModalVisible, targetCompanyId]);

  useEffect(() => {
    if (userModalVisible && loggedInCompanyId) {
      const fetchCompanyDepartments = async () => {
        setLoadingDepts(true);
        try {
          const res = await api.get('/departments');
          if (Array.isArray(res.data)) {
            // Filter departments matching logged-in admin's company ID
            const filtered = res.data.filter(
              (d: DepartmentItem) => d.company === Number(loggedInCompanyId)
            );
            setCompanyDepts(filtered);

            // Default selection to first department if available
            if (filtered.length > 0) {
              setUserForm((prev) => ({ ...prev, department: String(filtered[0].id) }));
            }
          }
        } catch (err) {
          console.error('Failed to fetch departments:', err);
        } finally {
          setLoadingDepts(false);
        }
      };

      fetchCompanyDepartments();
    }
  }, [userModalVisible, loggedInCompanyId]);

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

  // ---- Company Admin: add a staff user (host/security/staff) into their own company ----
  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.pswd || !userForm.phone) {
      Alert.alert('Validation Error', 'Please fill in Name, Email, Password, and Phone.');
      return;
    }
    console.log('---------------------------Logged-in user context:', user  );
    if (!loggedInCompanyId) {
      Alert.alert('Error', 'Your account is not linked to a company.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users', {
        name: userForm.name,
        email: userForm.email,
        pswd: userForm.pswd,
        phone: userForm.phone,
        gender: 'Male',
        dob: '2026-08-23',
        photo: 'string',
        company: Number(loggedInCompanyId), // Automatically takes company ID from logged-in admin
        department: parseInt(userForm.department, 10), // Selected department ID
        roles: userForm.roles[0] || 'host',
      });

      Alert.alert('Success', 'Staff account created successfully!');
      setUserModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to create user.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // Remove any user (company admin: their own staff. super_admin: an admin — see handleRemoveAdmin below, same call)
  const handleRemoveUser = (u: UserItem) => {
    const id = u.user_id || u.id;
    if (!id) return;
    const name = u.full_name || u.name || 'this user';
    Alert.alert('Remove User', `Remove ${name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingUserId(String(id));
          try {
            await api.delete(`/users/${id}`);
            fetchUsers();
          } catch (error: any) {
            const msg = error?.response?.data?.detail || 'Failed to remove user.';
            Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
          } finally {
            setRemovingUserId(null);
          }
        },
      },
    ]);
  };

  // ---- super_admin: companies ----
  const handleCreateCompany = async () => {
    if (!companyForm.name.trim()) {
      Alert.alert('Validation Error', 'Company name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/companies', {
        name: companyForm.name,
        location: companyForm.location || 'Default',
        contacts: { 
          additionalProp1: companyForm.additionalProp1 ?? null 
        }
      });
      Alert.alert('Success', 'Company created successfully!');
      setCompanyForm({ name: '', location: '' });
      setCompanyModalVisible(false);
      fetchOrgData();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to create company.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCompany = (company: CompanyItem) => {
    Alert.alert(
      'Remove Company',
      `Remove ${company.name}? This also affects its departments and admins.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingCompanyId(company.id);
            try {
              await api.delete(`/companies/${company.id}`);
              fetchOrgData();
            } catch (error: any) {
              const msg = error?.response?.data?.detail || 'Failed to remove company.';
              Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
            } finally {
              setRemovingCompanyId(null);
            }
          },
        },
      ]
    );
  };

  // ---- Departments (super_admin: any company via targetCompanyId. admin: frozen to own company) ----
  const openDeptModal = (companyId: number) => {
    setTargetCompanyId(companyId);
    setDeptForm({ name: '' });
    setDeptModalVisible(true);
  };

  const handleCreateDepartment = async () => {
    if (!deptForm.name.trim()) {
      Alert.alert('Validation Error', 'Department name is required.');
      return;
    }
    const companyId = isCompanyAdmin ? currentUserCompanyId : targetCompanyId;
    if (!companyId) {
      Alert.alert('Validation Error', 'No company selected for this department.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/departments', { name: deptForm.name, company: companyId });
      Alert.alert('Success', 'Department created successfully!');
      setDeptForm({ name: '' });
      setDeptModalVisible(false);
      fetchOrgData();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to create department.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveDepartment = (dept: DepartmentItem) => {
    Alert.alert('Remove Department', `Remove ${dept.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingDeptId(dept.id);
          try {
            await api.delete(`/departments/${dept.id}`);
            fetchOrgData();
          } catch (error: any) {
            const msg = error?.response?.data?.detail || 'Failed to remove department.';
            Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
          } finally {
            setRemovingDeptId(null);
          }
        },
      },
    ]);
  };

  // ---- super_admin: admins ----
  const openAdminModal = (companyId: number) => {
    setTargetCompanyId(companyId);
    setAdminForm({ name: '', email: '', pswd: '', phone: '', department: '' });
    setAdminModalVisible(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminForm.name || !adminForm.email || !adminForm.pswd || !adminForm.phone || !adminForm.department) {
      Alert.alert('Validation Error', 'Please fill in all required fields including Department.');
      return;
    }
    if (!targetCompanyId) {
      Alert.alert('Validation Error', 'No company selected for this admin.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/users', {
        name: adminForm.name,
        email: adminForm.email,
        pswd: adminForm.pswd,
        phone: adminForm.phone,
        gender: 'N/A',
        dob: '2000-01-01',
        photo: 'string',
        company: Number(targetCompanyId),
        department: parseInt(adminForm.department, 10), // Dynamically passed ID
        roles: 'admin',
      });
      Alert.alert('Success', 'Admin added successfully!');
      setAdminModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Failed to add admin.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // usersList is fetched globally for super_admin, so admins-per-company can be derived client-side.
  const adminsByCompany = useMemo(() => {
    const map: Record<string, UserItem[]> = {};
    usersList.forEach((u) => {
      const r = Array.isArray(u.roles) ? u.roles[0] : u.role || u.roles || '';
      if (String(r).toLowerCase() !== 'admin') return;
      const key = String(u.company);
      if (!map[key]) map[key] = [];
      map[key].push(u);
    });
    return map;
  }, [usersList]);

  const departmentsByCompany = useMemo(() => {
    const map: Record<string, DepartmentItem[]> = {};
    departments.forEach((d) => {
      const key = String(deptCompanyId(d));
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [departments]);

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
        {/* Header Row */}
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

        {/* Clean 2-Row Details Block */}
        <View style={styles.visitDetailsBlock}>
          {/* Row 1: Host & Purpose */}
          <View style={styles.detailRow}>
            <View style={[styles.visitDetailItem, { flex: 1 }]}>
              <Text style={styles.detailLabel}>Host</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {getHostName(visit.user)}
              </Text>
            </View>

            <View style={[styles.visitDetailItem, { flex: 1 }]}>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {visit.purpose || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          {/* Row 2: Timing & Gate */}
          <View style={styles.detailRow}>
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

  const renderRoleBadgeLabel = () => {
    if (isSuperAdmin) return 'SUPER ADMIN';
    if (isCompanyAdmin) return 'ADMIN';
    return userRole.toUpperCase();
  };

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.userName}>{user?.company_name || 'User Account'}'s Dashboard</Text>
              <Text style={styles.welcomeText}>{renderRoleBadgeLabel()}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} disabled={loggingOut}>
            <Text style={styles.logoutText}>{loggingOut ? 'Signing Out...' : 'Sign Out'}</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Switcher */}
        <View style={styles.segmentedTabContainer}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.activeTabBtn]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabBtnText, activeTab === t.key && styles.activeTabBtnText]}>
                {t.key === 'history' ? `${t.label} (${historyVisits.length})` : t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TAB: OVERVIEW (admin + regular users) */}
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

            {/* ADMIN QUICK ACTIONS */}
            {isCompanyAdmin && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeaderTitle}>Management Actions</Text>
                <View style={styles.adminActionRow}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setUserModalVisible(true)}>
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                      <Text style={[styles.actionIconText, { color: '#0A84FF' }]}>+</Text>
                    </View>
                    <View style={styles.actionCardBody}>
                      <Text style={styles.actionTitle}>Add User</Text>
                      <Text style={styles.actionSub}>Add staff to your company</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() => currentUserCompanyId && openDeptModal(Number(currentUserCompanyId))}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                      <Text style={[styles.actionIconText, { color: '#30D158' }]}>+</Text>
                    </View>
                    <View style={styles.actionCardBody}>
                      <Text style={styles.actionTitle}>Add Department</Text>
                      <Text style={styles.actionSub}>Within your company</Text>
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
                  <Text style={styles.badgeRoleText}>{renderRoleBadgeLabel()}</Text>
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

        {/* TAB: VISITOR HISTORY */}
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

        {/* TAB: DIRECTORY (read-only, non-admin roles) */}
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

        {/* TAB: TEAM (company admin — users + departments in their own company) */}
        {activeTab === 'team' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); fetchOrgData(); }} />}
          >
            {/* Departments */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Departments ({departments.length})</Text>
                <TouchableOpacity
                  style={styles.smallAddBtn}
                  onPress={() => loggedInCompanyId && openDeptModal(Number(loggedInCompanyId))}
                >
                  <Text style={styles.smallAddBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {loadingOrg ? (
                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 12 }} />
              ) : departments.length > 0 ? (
                <View style={styles.chipWrapRow}>
                  {departments.map((d) => (
                    <View key={d.id} style={styles.deptChip}>
                      <View style={styles.chipInnerContainer}>
                        <Text style={styles.deptChipText}>{d.name}</Text>
                        <TouchableOpacity onPress={() => handleRemoveDepartment(d)} disabled={removingDeptId === d.id}>
                          {removingDeptId === d.id ? (
                            <ActivityIndicator size="small" color="#FF453A" />
                          ) : (
                            <Text style={styles.deptChipRemove}>✕</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No departments yet.</Text>
                </View>
              )}
            </View>

            {/* Users */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Users ({usersList.length})</Text>
                <TouchableOpacity style={styles.smallAddBtn} onPress={() => setUserModalVisible(true)}>
                  <Text style={styles.smallAddBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {loadingUsers ? (
                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 12 }} />
              ) : usersList.length > 0 ? (
                usersList.map((u) => {
                  const id = String(u.user_id || u.id);
                  const name = u.full_name || u.name || 'User';
                  const roleStr = (Array.isArray(u.roles) ? u.roles[0] : u.role || 'user').toUpperCase();
                  return (
                    <View key={id} style={styles.directoryCard}>
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
                        <Text style={styles.dirEmail}>{u.email || u.username || 'No email'}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeIconBtn}
                        onPress={() => handleRemoveUser(u)}
                        disabled={removingUserId === id}
                      >
                        {removingUserId === id ? (
                          <ActivityIndicator size="small" color="#FF453A" />
                        ) : (
                          <Text style={styles.removeIconText}>Remove</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No users in your company yet.</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* TAB: ORGANIZATIONS (super_admin — companies, their departments, their admins) */}
        {activeTab === 'organizations' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrgData(); fetchUsers(); }} />}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Companies ({companies.length})</Text>
              <TouchableOpacity style={styles.smallAddBtn} onPress={() => setCompanyModalVisible(true)}>
                <Text style={styles.smallAddBtnText}>+ New Company</Text>
              </TouchableOpacity>
            </View>

            {loadingOrg ? (
              <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 20 }} />
            ) : companies.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No companies yet. Create one to get started.</Text>
              </View>
            ) : (
              companies.map((c) => {
                const compDepts = departmentsByCompany[String(c.id)] || [];
                const compAdmins = adminsByCompany[String(c.id)] || [];
                return (
                  <Card key={c.id} style={styles.companyCard}>
                    <View style={styles.companyCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.companyName}>{c.name}</Text>
                        {!!c.location && <Text style={styles.companyLocation}>{c.location}</Text>}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveCompany(c)}
                        disabled={removingCompanyId === c.id}
                      >
                        {removingCompanyId === c.id ? (
                          <ActivityIndicator size="small" color="#FF453A" />
                        ) : (
                          <Text style={styles.removeIconText}>Remove</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Departments */}
                    <View style={styles.companySubSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.companySubLabel}>Departments ({compDepts.length})</Text>
                        <TouchableOpacity onPress={() => openDeptModal(c.id)}>
                          <Text style={styles.smallAddBtnText}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                      {compDepts.length > 0 ? (
                        <View style={styles.chipWrapRow}>
                          {compDepts.map((d) => (
                            <View key={d.id} style={styles.deptChip}>
                              <Text style={styles.deptChipText}>{d.name}</Text>
                              <TouchableOpacity onPress={() => handleRemoveDepartment(d)} disabled={removingDeptId === d.id}>
                                {removingDeptId === d.id ? (
                                  <ActivityIndicator size="small" color="#FF453A" />
                                ) : (
                                  <Text style={styles.deptChipRemove}>✕</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.companySubEmpty}>No departments.</Text>
                      )}
                    </View>

                    {/* Admins */}
                    <View style={styles.companySubSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.companySubLabel}>Admins ({compAdmins.length})</Text>
                        <TouchableOpacity onPress={() => openAdminModal(c.id)}>
                          <Text style={styles.smallAddBtnText}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                      {compAdmins.length > 0 ? (
                        compAdmins.map((a) => {
                          const id = String(a.user_id || a.id);
                          return (
                            <View key={id} style={styles.adminRow}>
                              <Text style={styles.adminRowName}>{a.full_name || a.name || 'Admin'}</Text>
                              <TouchableOpacity onPress={() => handleRemoveUser(a)} disabled={removingUserId === id}>
                                {removingUserId === id ? (
                                  <ActivityIndicator size="small" color="#FF453A" />
                                ) : (
                                  <Text style={styles.removeIconText}>Remove</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.companySubEmpty}>No admins assigned.</Text>
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        )}

        {/* TAB: RAW PAYLOAD */}
        {activeTab === 'raw' && (
          <ScrollView style={styles.codeBlockContainer}>
            <Text style={styles.codeText}>{JSON.stringify(data, null, 2)}</Text>
          </ScrollView>
        )}
      </View>

      {/* MODAL: Add Staff User (company admin) */}
      <Modal visible={userModalVisible} animationType="fade" transparent onRequestClose={() => setUserModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add User to Your Company</Text>
            <ScrollView style={{ width: '100%', maxHeight: 420 }}>
              <TextInput style={styles.input} placeholder="Full Name *" placeholderTextColor="#7C7C80" value={userForm.name} onChangeText={(v) => setUserForm({ ...userForm, name: v })} />
              <TextInput style={styles.input} placeholder="Email *" placeholderTextColor="#7C7C80" keyboardType="email-address" autoCapitalize="none" value={userForm.email} onChangeText={(v) => setUserForm({ ...userForm, email: v })} />
              <TextInput style={styles.input} placeholder="Password *" placeholderTextColor="#7C7C80" secureTextEntry value={userForm.pswd} onChangeText={(v) => setUserForm({ ...userForm, pswd: v })} />
              <TextInput style={styles.input} placeholder="Phone *" placeholderTextColor="#7C7C80" keyboardType="phone-pad" value={userForm.phone} onChangeText={(v) => setUserForm({ ...userForm, phone: v })} />

              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.chipWrapRow}>
                {STAFF_ROLE_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.filterChip, userForm.roles[0] === r && styles.filterChipActive]}
                    onPress={() => setUserForm({ ...userForm, roles: [r] })}
                  >
                    <Text style={[styles.filterChipText, userForm.roles[0] === r && styles.filterChipTextActive]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* DEPARTMENT SELECTOR - FIX APPLIED HERE */}
              <Text style={styles.fieldLabel}>Department *</Text>
              {loadingDepts ? (
                <ActivityIndicator color="#007AFF" style={{ marginVertical: 8 }} />
              ) : companyDepts.length === 0 ? (
                <Text style={{ color: '#7C7C80', fontSize: 12, fontStyle: 'italic', marginVertical: 4 }}>
                  No departments registered for your company.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                  {companyDepts.map((d) => {
                    const isSelected = userForm.department === String(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.filterChip, isSelected && styles.filterChipActive]}
                        onPress={() => setUserForm({ ...userForm, department: String(d.id) })}
                      >
                        <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
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

      {/* MODAL: New Company (super_admin) */}
      <Modal visible={companyModalVisible} animationType="fade" transparent onRequestClose={() => setCompanyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Company</Text>
            <TextInput style={styles.input} placeholder="Company Name *" placeholderTextColor="#7C7C80" value={companyForm.name} onChangeText={(v) => setCompanyForm({ ...companyForm, name: v })} />
            <TextInput style={styles.input} placeholder="Location" placeholderTextColor="#7C7C80" value={companyForm.location} onChangeText={(v) => setCompanyForm({ ...companyForm, location: v })} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCompanyModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateCompany} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: New Department (admin: own company. super_admin: targetCompanyId) */}
      <Modal visible={deptModalVisible} animationType="fade" transparent onRequestClose={() => setDeptModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              New Department{isSuperAdmin && targetCompanyId ? ` — ${companyName(targetCompanyId)}` : ''}
            </Text>
            <TextInput style={styles.input} placeholder="Department Name *" placeholderTextColor="#7C7C80" value={deptForm.name} onChangeText={(v) => setDeptForm({ name: v })} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeptModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateDepartment} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: New Admin (super_admin, for targetCompanyId) */}
      <Modal visible={adminModalVisible} animationType="fade" transparent onRequestClose={() => setAdminModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Admin{targetCompanyId ? ` — ${companyName(targetCompanyId)}` : ''}
            </Text>
            
            <ScrollView style={{ width: '100%', maxHeight: 420 }}>
              <TextInput style={styles.input} placeholder="Full Name *" placeholderTextColor="#7C7C80" value={adminForm.name} onChangeText={(v) => setAdminForm({ ...adminForm, name: v })} />
              <TextInput style={styles.input} placeholder="Email *" placeholderTextColor="#7C7C80" keyboardType="email-address" autoCapitalize="none" value={adminForm.email} onChangeText={(v) => setAdminForm({ ...adminForm, email: v })} />
              <TextInput style={styles.input} placeholder="Password *" placeholderTextColor="#7C7C80" secureTextEntry value={adminForm.pswd} onChangeText={(v) => setAdminForm({ ...adminForm, pswd: v })} />
              <TextInput style={styles.input} placeholder="Phone *" placeholderTextColor="#7C7C80" keyboardType="phone-pad" value={adminForm.phone} onChangeText={(v) => setAdminForm({ ...adminForm, phone: v })} />

              {/* DEPARTMENT SELECTOR */}
              <Text style={styles.sectionLabel}>Select Department *</Text>
              {loadingDepts ? (
                <ActivityIndicator color="#007AFF" style={{ marginVertical: 10 }} />
              ) : departments.length === 0 ? (
                <Text style={styles.noDataText}>No departments found for this company.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                  {departments.map((dept) => {
                    const isSelected = String(adminForm.department) === String(dept.id);
                    return (
                      <TouchableOpacity
                        key={dept.id}
                        style={[styles.deptChip, isSelected && styles.activeDeptChip]}
                        onPress={() => setAdminForm({ ...adminForm, department: String(dept.id) })}
                      >
                        <Text style={[styles.deptText, isSelected && styles.activeDeptText]}>
                          {dept.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdminModalVisible(false)} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAdmin} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Add Admin</Text>}
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
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  userName: {
    fontSize: 10,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  smallAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  smallAddBtnText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  chipWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  deptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  deptChipText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deptChipRemove: {
    color: '#FF453A',
    fontSize: 10,
    fontWeight: '700',
  },
  removeIconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeIconText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '700',
  },
  companyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  companyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  companyName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  companyLocation: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  companySubSection: {
    marginTop: 8,
  },
  companySubLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  companySubEmpty: {
    color: '#7C7C80',
    fontSize: 12,
    fontStyle: 'italic',
  },
  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  adminRowName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
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
  visitDetailItem: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
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
  visitDetailsBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 2,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#7C7C80',
    marginTop: 8,
    marginBottom: 6,
    fontWeight: '600',
  },
  deptChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  activeDeptChip: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  deptText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
  },
  activeDeptText: {
    color: '#fff',
    fontWeight: '700',
  },
  noDataText: {
    color: '#7C7C80',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  chipInnerContainer: {
    flexDirection: 'row',     // Forces items onto the same line
    alignItems: 'center',     // Centers items vertically relative to each other
    gap: 6,                   // Adds space between the text and the ✕ button
  },
});