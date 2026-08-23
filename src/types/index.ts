export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CompanyResponse {
  id: number;
  name: string;
  location: string;
  contacts: object;
  tm_cr: string;
  tm_up?: string;
  status: number;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  company: number;
  tm_cr: string;
  tm_up?: string;
  status: number;
}

export interface VisitorResponse {
  id: number;
  name: string;
  gender: string;
  email: string;
  phone: string;
  organisation: string;
  photo: string;
  status: number;
  tm_cr: string;
  tm_up?: string;
  tm_rm?: string;
}

export interface VisitorCreate {
  name: string;
  gender: string;
  email: string;
  phone: string;
  organisation: string;
  photo: string;
}

export interface VisitResponse {
  id: number;
  visitor: number;
  company: number;
  department: number;
  purpose: string;
  tm_in: string;
  tm_out: string;
  status: string;
  badge: string;
  otp: string;
  entry_gate: string;
  exit_gate: string;
  vehicle_number: string;
  vehicle_type: string;
  tm_cr: string;
  tm_up?: string;
  tm_rm?: string;
}

export interface VisitCreate {
  visitor: number;
  company: number;
  department: number;
  purpose: string;
  tm_in: string;
  tm_out: string;
  badge: string;
  otp: string;
  entry_gate: string;
  exit_gate: string;
  vehicle_number: string;
  vehicle_type: string;
  status?: string;
}
