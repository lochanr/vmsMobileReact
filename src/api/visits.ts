// src/api/visits.ts
import api from './client';

export const getVisits = () => api.get('/visits').then(r => r.data);
export const createVisit = (body: VisitCreate) => api.post('/visits', body).then(r => r.data);
export const updateVisit = (id: number, body: VisitUpdate) => api.put(`/visits/${id}`, body).then(r => r.data);
export const deleteVisit = (id: number) => api.delete(`/visits/${id}`).then(r => r.data);
export const checkin = (id: number, body: { badge?: string; entry_gate?: string }) => 
  api.post(`/vms/visits/${id}/checkin`, body).then(r => r.data);
export const checkout = (id: number, body: { exit_gate?: string }) => 
  api.post(`/vms/visits/${id}/checkout`, body).then(r => r.data);
export const approve = (id: number, body?: { remarks?: string }) => 
  api.patch(`/vms/visits/${id}/approve`, body).then(r => r.data);
export const reject = (id: number, body?: { reason?: string }) => 
  api.patch(`/vms/visits/${id}/reject`, body).then(r => r.data);
