// ─── Currency & Numeric Formatting (Indonesian Locale id-ID: Rp 1.250.000,00) ───
const NUM = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const NUM2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM4 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export const fmtNum = (v) => NUM.format(Number(v) || 0)
export const fmtNum2 = (v) => NUM2.format(Number(v) || 0)
export const fmtNum4 = (v) => NUM4.format(Number(v) || 0)

export const fmtIDR = (v) => {
  const n = Number(v) || 0
  const isNegative = n < 0
  const absVal = Math.abs(n)

  // If value has non-zero decimals, format with NUM2 (2 decimal places)
  const formatted = (absVal % 1 !== 0) ? NUM2.format(absVal) : NUM.format(absVal)
  if (isNegative) return `-${formatted}`
  return formatted
}

export const fmtIDR2 = (v) => {
  const n = Number(v) || 0
  if (n < 0) return `-${NUM2.format(Math.abs(n))}`
  return NUM2.format(n)
}

export const fmtIDR4 = (v) => {
  const n = Number(v) || 0
  if (n < 0) return `-${NUM4.format(Math.abs(n))}`
  return NUM4.format(n)
}

export const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`

// ─── Date Formatting ─────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtDateTime(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function fmtMonthYear(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}
export function monthStart(d = new Date()) {
  const dt = new Date(d)
  return new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString().split('T')[0]
}
export function monthEnd(d = new Date()) {
  const dt = new Date(d)
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).toISOString().split('T')[0]
}
export function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a)
  return Math.round(ms / 86400000)
}

// ─── Accounting helpers ───────────────────────────────────────
export function calcBalance(account, totalDebit, totalCredit) {
  if (account.naturalBalance === 'DEBIT') return totalDebit - totalCredit
  return totalCredit - totalDebit
}

export function accountTypeLabel(t) {
  return { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' }[t] || t
}
export function accountTypeBadge(t) {
  return {
    ASSET: 'badge-blue',
    LIABILITY: 'badge-red',
    EQUITY: 'badge-purple',
    REVENUE: 'badge-green',
    EXPENSE: 'badge-yellow',
  }[t] || 'badge-gray'
}
export function entryStatusBadge(s) {
  return { DRAFT: 'badge-yellow', POSTED: 'badge-green', REVERSED: 'badge-red' }[s] || 'badge-gray'
}
export function paymentMethodLabel(m) {
  return {
    TUNAI: 'Tunai / Cash', QRIS: 'QRIS / E-Wallet', TRANSFER: 'Transfer Bank',
    BPJS: 'BPJS Kesehatan', ASURANSI: 'Asuransi Swasta', MIXED: 'Pembayaran Campuran',
    KAS: 'Kas Kecil Klinik (1-11-001)', KAS_BESAR: 'Kas Besar Klinik (1-11-002)',
    KARTU_KREDIT: 'Kartu Kredit Operasional (2-11-005)',
  }[m] || m
}

// ─── PPh 21 Calculator (PER-2/PJ/2024 - Bukan Pegawai) ──────
export function calcPPh21Doctor(grossAmount, cumulativeGrossYTD = 0) {
  const dpp = grossAmount * 0.50
  const totalDPP = cumulativeGrossYTD + dpp

  let rate
  if (totalDPP <= 60_000_000) rate = 0.05
  else if (totalDPP <= 250_000_000) rate = 0.15
  else if (totalDPP <= 500_000_000) rate = 0.25
  else rate = 0.30

  const pph21 = dpp * rate
  return {
    grossAmount,
    dpp,
    rate,
    pph21Amount: pph21,
    netToDoctor: grossAmount - pph21,
  }
}

// ─── PPN Calculator (11% sesuai UU HPP 2022) ─────────────────
export const PPN_RATE = 0.11
export function calcPPN(dpp) {
  return { dpp, ppn: dpp * PPN_RATE, total: dpp * (1 + PPN_RATE) }
}

// ─── Number input helper (Supports ID & US format: 1.250.000,50 -> 1250000.50) ───
export function parseNumericInput(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val

  let str = String(val).trim()

  // Handle Indonesian format where dot is thousand separator and comma is decimal
  // e.g. "1.250.000,50" -> "1250000.50"
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    // e.g. "1250000,50" -> "1250000.50"
    str = str.replace(',', '.')
  } else if (str.includes('.')) {
    // If string has dot(s) and NO comma:
    // In Indonesian accounting, dot is standard thousand separator (e.g. 1.000, 10.000, 100.000, 1.000.000)
    const dotParts = str.split('.')
    if (dotParts.length > 2) {
      str = str.replace(/\./g, '')
    } else if (dotParts.length === 2) {
      // If right side has 3 or more digits (e.g. "1.000" or user typed another digit "1.0000"), it's thousand separator!
      if (dotParts[1].length >= 3) {
        str = str.replace(/\./g, '')
      }
    }
  }

  // Remove non-numeric characters except leading minus and dot
  const cleaned = str.replace(/[^\d.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

