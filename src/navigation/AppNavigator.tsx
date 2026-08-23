import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import StaffDashboard from '../screens/StaffDashboard';
import AdminDashboard from '../screens/AdminDashboard';
import PhoneScreen from '../screens/PhoneScreen';
import PhotoScreen from '../screens/PhotoScreen';
import DetailsScreen from '../screens/DetailsScreen';
import WaitingScreen from '../screens/WaitingScreen';
import PassScreen from '../screens/PassScreen';
import RecoverScreen from '../screens/RecoverScreen';
import Dashboard from '../screens/Dashboard';
import ScanScreen from '../screens/ScanScreen';

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  StaffDashboard: undefined;
  AdminDashboard: undefined;
  Phone: undefined;
  Photo: undefined;
  Details: undefined;
  Waiting: { visitId: number };
  Pass: { visitId: number };
  Recover: undefined;
  Dashboard: { data: any };
  Scan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080c14' } }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="StaffDashboard" component={StaffDashboard} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="Phone" component={PhoneScreen} />
        <Stack.Screen name="Photo" component={PhotoScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Waiting" component={WaitingScreen} />
        <Stack.Screen name="Pass" component={PassScreen} />
        <Stack.Screen name="Recover" component={RecoverScreen} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="Scan" component={ScanScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
