import { v4 as uuidv4 } from 'uuid'

export const initialBranches = [
  {
    id: 'hq-001',
    entityName: 'Klinik Medis Antigravity — Pusat',
    branchCode: 'HQ-001',
    address: 'Jl. Sudirman No. 1, Jakarta Pusat',
    phone: '021-12345678',
    email: 'pusat@antigravity-klinik.id',
    npwp: '01.234.567.8-901.000',
    sikNumber: 'SIK/JKT/001/2024',
    isHeadquarters: true,
    isActive: true,
  },
  {
    id: 'br-002',
    entityName: 'Klinik Medis Antigravity — Cabang Selatan',
    branchCode: 'BR-002',
    address: 'Jl. Fatmawati No. 45, Jakarta Selatan',
    phone: '021-87654321',
    email: 'selatan@antigravity-klinik.id',
    npwp: '01.234.567.8-902.000',
    sikNumber: 'SIK/JKT/002/2024',
    isHeadquarters: false,
    isActive: true,
  },
]
