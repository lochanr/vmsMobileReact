import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useVisitorStore } from '../store/useVisitorStore';
import { api } from '../api/client';
import { Colors } from '../constants/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface UserHostItem {
  id: number | string;
  user_id?: string;
  name: string;
  roles: string | string[];
  company?: number;
  department?: number;
}

interface CompanyItem {
  id: number;
  name: string;
}

interface DepartmentItem {
  id: number;
  name: string;
}

export default function DetailsScreen() {
  const nav = useNavigation<Nav>();
  const { phone, email, photoBase64, reset } = useVisitorStore();

  const [profile, setProfile] = useState({
    name: '',
    gender: 'Male',
    companyName: '',
  });
  const [purpose, setPurpose] = useState('');
  
  // Logistics & Vehicle state
  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('4-Wheeler');
  const [entryGate, setEntryGate] = useState('Main Gate');

  // Hosts and Organization Data
  const [allUsers, setAllUsers] = useState<UserHostItem[]>([]);
  const [companiesMap, setCompaniesMap] = useState<Record<number, string>>({});
  const [departmentsMap, setDepartmentsMap] = useState<Record<number, string>>({});

  const [selectedHostId, setSelectedHostId] = useState<string>('');
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      setLoadingHosts(true);
      try {
        const [usersRes, compRes, deptRes] = await Promise.allSettled([
          api.get('/users'),
          api.get('/companies'),
          api.get('/departments'),
        ]);

        if (compRes.status === 'fulfilled' && Array.isArray(compRes.value.data)) {
          const cMap: Record<number, string> = {};
          compRes.value.data.forEach((c: CompanyItem) => {
            cMap[c.id] = c.name;
          });
          setCompaniesMap(cMap);
        }

        if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value.data)) {
          const dMap: Record<number, string> = {};
          deptRes.value.data.forEach((d: DepartmentItem) => {
            dMap[d.id] = d.name;
          });
          setDepartmentsMap(dMap);
        }

        if (usersRes.status === 'fulfilled') {
          const rawUsers: UserHostItem[] = Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
          const hostOnlyList = rawUsers.filter((u) => {
            const roleStr = Array.isArray(u.roles) ? u.roles[0] : u.roles;
            return roleStr?.toLowerCase() !== 'admin';
          });

          setAllUsers(hostOnlyList);
          if (hostOnlyList.length > 0) {
            setSelectedHostId(String(hostOnlyList[0].user_id ?? hostOnlyList[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load host metadata', err);
      } finally {
        setLoadingHosts(false);
      }
    };

    fetchData();
  }, []);

  const companyOptions = useMemo(() => {
    const names = allUsers
      .map((u) => (u.company ? companiesMap[u.company] : null))
      .filter((name): name is string => Boolean(name));
    return ['ALL', ...Array.from(new Set(names))];
  }, [allUsers, companiesMap]);

  const departmentOptions = useMemo(() => {
    const names = allUsers
      .map((u) => (u.department ? departmentsMap[u.department] : null))
      .filter((name): name is string => Boolean(name));
    return ['ALL', ...Array.from(new Set(names))];
  }, [allUsers, departmentsMap]);

  const filteredHosts = useMemo(() => {
    return allUsers.filter((u) => {
      const compName = u.company ? companiesMap[u.company] : '';
      const deptName = u.department ? departmentsMap[u.department] : '';

      const matchCompany = selectedCompany === 'ALL' || compName === selectedCompany;
      const matchDept = selectedDepartment === 'ALL' || deptName === selectedDepartment;

      return matchCompany && matchDept;
    });
  }, [allUsers, selectedCompany, selectedDepartment, companiesMap, departmentsMap]);

  const handleSubmit = async () => {
    if (!profile.name.trim() || !purpose.trim()) {
      return Alert.alert('Error', 'Please fill all required fields');
    }
    if (!selectedHostId) {
      return Alert.alert('Error', 'Please select a host to meet');
    }
    if (hasVehicle && !vehicleNumber.trim()) {
      return Alert.alert('Error', 'Please enter your vehicle number');
    }

    setLoading(true);

    try {
      // API 1: Create Visitor Record
      const visitorPayload = {
        name: profile.name,
        gender: profile.gender || 'Male',
        email: email,
        phone: phone,
        organisation: profile.companyName || 'N/A',
        photo: photoBase64 || 'string',
      };

      const visitorRes = await api.post('/visitors', visitorPayload);
      const visitorId = visitorRes.data?.id;

      if (!visitorId) {
        throw new Error('Failed to obtain visitor ID from server');
      }

      // API 2: Create Visit Record using Visitor ID
      const selectedHostObj = allUsers.find(
        (u) => String(u.user_id ?? u.id) === String(selectedHostId)
      );

      const currentTimeISO = new Date().toISOString();

      const visitPayload = {
        visitor: Number(visitorId),
        company: selectedHostObj?.company ? Number(selectedHostObj.company) : 1,
        department: selectedHostObj?.department ? Number(selectedHostObj.department) : 1,
        user: Number(selectedHostId) || 1,
        purpose: purpose,
        tm_in: currentTimeISO,
        tm_out: currentTimeISO,
        status: 'pending',
        badge: 'string',
        otp: 'VERIFIED',
        entry_gate: entryGate || 'Main Gate',
        exit_gate: 'N/A',
        vehicle_number: hasVehicle ? vehicleNumber.toUpperCase() : 'N/A',
        vehicle_type: hasVehicle ? vehicleType : 'N/A',
      };

      const visitRes = await api.post('/visits', visitPayload);
      const visitId = visitRes.data?.id;

      reset();
      nav.navigate('Waiting', { visitId });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Check-in failed';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#080c14']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <TouchableOpacity onPress={() => nav.goBack()} style={{ marginBottom: 28 }}>
            <Text style={{ color: Colors.muted, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 24 }}>
            <Text style={styles.step}>STEP 3 OF 3</Text>
            <Text style={styles.title}>Visit Details</Text>
          </View>

          {/* Visitor Details */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.section}>VISITOR PROFILE</Text>
            <Input
              label="Full Name *"
              value={profile.name}
              onChangeText={(t) => setProfile((p) => ({ ...p, name: t }))}
              placeholder="John Doe"
            />
            
            <Text style={styles.label}>Gender:</Text>
            <View style={styles.filterRow}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, profile.gender === g && styles.activeFilterChip]}
                  onPress={() => setProfile((p) => ({ ...p, gender: g }))}
                >
                  <Text style={[styles.filterText, profile.gender === g && styles.activeFilterText]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Organisation / Company"
              value={profile.companyName}
              onChangeText={(t) => setProfile((p) => ({ ...p, companyName: t }))}
              placeholder="Acme Corp"
            />
            <Input label="Phone" value={phone} editable={false} style={{ opacity: 0.5 }} />
            <Input label="Email" value={email} editable={false} style={{ opacity: 0.5 }} />
          </Card>

          {/* Logistics & Vehicle */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.section}>LOGISTICS</Text>
            <Input
              label="Entry Gate"
              value={entryGate}
              onChangeText={setEntryGate}
              placeholder="Main Gate"
            />

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Arrived with Vehicle?</Text>
              <Switch
                value={hasVehicle}
                onValueChange={setHasVehicle}
                trackColor={{ false: '#334155', true: Colors.accent }}
              />
            </View>

            {hasVehicle && (
              <>
                <Input
                  label="Vehicle Number *"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  placeholder="KA-01-AB-1234"
                  autoCapitalize="characters"
                />
                <Text style={styles.label}>Vehicle Type:</Text>
                <View style={styles.filterRow}>
                  {['2-Wheeler', '4-Wheeler', 'Commercial'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.filterChip, vehicleType === type && styles.activeFilterChip]}
                      onPress={() => setVehicleType(type)}
                    >
                      <Text style={[styles.filterText, vehicleType === type && styles.activeFilterText]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* Visit Details & Host Selection */}
          <Card style={{ marginBottom: 24 }}>
            <Text style={styles.section}>HOST & PURPOSE</Text>
            <Input
              label="Purpose of Visit *"
              value={purpose}
              onChangeText={setPurpose}
              placeholder="Meeting / Interview"
            />

            <Text style={styles.label}>Filter Host By Company:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {companyOptions.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.filterChip, selectedCompany === c && styles.activeFilterChip]}
                  onPress={() => setSelectedCompany(c)}
                >
                  <Text style={[styles.filterText, selectedCompany === c && styles.activeFilterText]}>
                    {c === 'ALL' ? 'All Companies' : c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Filter Host By Department:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {departmentOptions.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.filterChip, selectedDepartment === d && styles.activeFilterChip]}
                  onPress={() => setSelectedDepartment(d)}
                >
                  <Text style={[styles.filterText, selectedDepartment === d && styles.activeFilterText]}>
                    {d === 'ALL' ? 'All Departments' : d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: 8 }]}>Select Host to Meet *</Text>
            {loadingHosts ? (
              <ActivityIndicator color={Colors.accent} style={{ marginVertical: 12 }} />
            ) : filteredHosts.length === 0 ? (
              <Text style={styles.noHostText}>No hosts found matching selected filters.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hostRow}>
                {filteredHosts.map((host) => {
                  const hostId = String(host.user_id ?? host.id);
                  const isSelected = selectedHostId === hostId;
                  const deptName = host.department ? departmentsMap[host.department] : undefined;

                  return (
                    <TouchableOpacity
                      key={hostId}
                      style={[styles.hostChip, isSelected && styles.activeHostChip]}
                      onPress={() => setSelectedHostId(hostId)}
                    >
                      <Text style={[styles.hostName, isSelected && styles.activeHostText]}>
                        {host.name}
                      </Text>
                      {deptName && (
                        <Text style={[styles.hostDept, isSelected && styles.activeHostText]}>
                          {deptName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Card>

          <Button
            label={loading ? 'Registering Visit...' : 'Submit Visit Request →'}
            onPress={handleSubmit}
            loading={loading}
          />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 11, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  section: { fontSize: 10, color: Colors.accent, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 14 },
  label: { fontSize: 12, color: Colors.text, marginBottom: 6, fontWeight: '600' },
  toggleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  toggleLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', marginBottom: 12 },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 6,
  },
  activeFilterChip: { backgroundColor: '#007AFF' },
  filterText: { color: '#aaa', fontSize: 12, fontWeight: '500' },
  activeFilterText: { color: '#fff', fontWeight: '700' },
  hostRow: { flexDirection: 'row', marginTop: 4, marginBottom: 12 },
  hostChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  activeHostChip: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  hostName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hostDept: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  activeHostText: { color: '#fff' },
  noHostText: { color: Colors.muted, fontSize: 13, marginVertical: 12, fontStyle: 'italic' },
});