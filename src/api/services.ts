import { api } from './client';
import type {
  VisitorCreate, VisitorResponse, VisitCreate, VisitResponse,
  CompanyResponse, DepartmentResponse,
} from '../types';

export interface CheckInPayload {
  full_name: string;
  phone_number: string;
  email: string;
  photo_base64: string;
  company_name: string;
  purpose: string;
  host_id: string;
}

export const getCompanies = () => api.get<CompanyResponse[]>('/companies').then(r => r.data);
export const getDepartments = () => api.get<DepartmentResponse[]>('/departments').then(r => r.data);
export const getVisitors = () => api.get<VisitorResponse[]>('/visitors').then(r => r.data);
export const createVisitor = (body: VisitorCreate) => api.post<VisitorResponse>('/visitors', body).then(r => r.data);
export const getVisitor = (id: number) => api.get<VisitorResponse>(`/visitors/${id}`).then(r => r.data);

export const getVisits = () => api.get<VisitResponse[]>('/visits').then(r => r.data);
export const createVisit = (body: VisitCreate) => api.post<VisitResponse>('/visits', body).then(r => r.data);
export const getVisit = (id: number) => api.get<VisitResponse>(`/visits/${id}`).then(r => r.data);
export const updateVisit = (id: number, body: Partial<VisitCreate>) => api.put<VisitResponse>(`/visits/${id}`, body).then(r => r.data);

export const checkinVisit = (id: number, body?: { badge?: string; entry_gate?: string }) => api.post(`/vms/visits/${id}/checkin`, body).then(r => r.data);
export const checkoutVisit = (id: number, body?: { exit_gate?: string }) => api.post(`/vms/visits/${id}/checkout`, body).then(r => r.data);
export const approveVisit = (id: number, body?: { remarks?: string }) => api.patch(`/vms/visits/${id}/approve`, body).then(r => r.data);
export const rejectVisit = (id: number, body?: { reason?: string }) => api.patch(`/vms/visits/${id}/reject`, body).then(r => r.data);


// 1. Submit Visitor Check-In
export const checkInVisitor = async (payload: CheckInPayload) => {
  const res = await api.post('/visits/check-in', payload);
  return res.data; // expects { visit_id: "...", status: "PENDING", ... }
};

// 2. Fetch Hosts List for Host Selection Dropdown/Picker
export const getHosts = async () => {
  const res = await api.get('/users/hosts');
  return res.data; 
};

// 3. Get Single Visit Details (for Waiting/Polling screen)
export const getVisitStatus = async (visitId: string) => {
  try {
    const res = await api.get(`/visits/${visitId}`);
    // If backend wraps response in data field (e.g. { data: { status: "APPROVED" } })
    return res.data?.data || res.data;
  } catch (error) {
    console.error('Error fetching visit status:', error);
    throw error;
  }
};

// 4. Host Actions: Approve or Reject Visit
export const updateVisitStatus = async (visitId: string, status: 'APPROVED' | 'REJECTED') => {
  const res = await api.patch(`/visits/${visitId}/status`, { status });
  return res.data;
};