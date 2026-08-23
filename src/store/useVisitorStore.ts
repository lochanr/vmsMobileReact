import { create } from 'zustand';

interface ReturningVisitor {
  id: number;
  name: string;
  organisation: string;
  photo: string;
}

interface VisitorStore {
  phone: string;
  email: string;
  photoUri: string;
  photoBase64: string;
  returningVisitor: ReturningVisitor | null;
  setPhone: (p: string) => void;
  setEmail: (e: string) => void;
  setPhoto: (uri: string, base64: string) => void;
  setReturningVisitor: (v: ReturningVisitor | null) => void;
  reset: () => void;
}

export const useVisitorStore = create<VisitorStore>((set) => ({
  phone: '',
  email: '',
  photoUri: '',
  photoBase64: '',
  returningVisitor: null,
  setPhone: (phone) => set({ phone }),
  setEmail: (email) => set({ email }),
  setPhoto: (photoUri, photoBase64) => set({ photoUri, photoBase64 }),
  setReturningVisitor: (returningVisitor) => set({ returningVisitor }),
  reset: () => set({ phone: '', email: '', photoUri: '', photoBase64: '', returningVisitor: null }),
}));
