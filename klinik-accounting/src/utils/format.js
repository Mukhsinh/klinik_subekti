// ─── Currency Formatting ─────────────────────────────────────
const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
})
const IDR2 = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const NUM = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const NUM4 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export const fmtIDR   = (v) => IDR.format(Number(v) || 0)
export const fmtIDR2  = (v) => IDR2.format(Number(v) || 0)
export const fmtNum   = (v) => NUM.format(Number(v) || 0)
export const fmtNum4  = (v) => NUM4.format(Number(v) || 0)
export const fmtPct   = (v) => `${Number(v || 0).toFixed(2)}%`

// ─── Date Formatting ─────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })
}
export function fmtDateTime(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
export function fmtMonthYear(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('id-ID', { month:'long', year:'numeric' })
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
  return { ASSET:'Aset', LIABILITY:'Liabilitas', EQUITY:'Ekuitas', REVENUE:'Pendapatan', EXPENSE:'Beban' }[t] || t
}
export function accountTypeBadge(t) {
  return {
    ASSET:    'badge-blue',
    LIABILITY:'badge-red',
    EQUITY:   'badge-purple',
    REVENUE:  'badge-green',
    EXPENSE:  'badge-yellow',
  }[t] || 'badge-gray'
}
export function entryStatusBadge(s) {
  return { DRAFT:'badge-yellow', POSTED:'badge-green', REVERSED:'badge-red' }[s] || 'badge-gray'
}
export function paymentMethodLabel(m) {
  return {
    TUNAI:'Tunai / Cash', QRIS:'QRIS / E-Wallet', TRANSFER:'Transfer Bank',
    BPJS:'BPJS Kesehatan', ASURANSI:'Asuransi Swasta', MIXED:'Pembayaran Campuran',
    KAS:'Kas', KARTU_KREDIT:'Kartu Kredit',
  }[m] || m
}

// ─── PPh 21 Calculator (PER-2/PJ/2024 - Bukan Pegawai) ──────
export function calcPPh21Doctor(grossAmount, cumulativeGrossYTD = 0) {
  const dpp = grossAmount * 0.50
  const totalDPP = cumulativeGrossYTD + dpp

  let rate
  if (totalDPP <= 60_000_000)       rate = 0.05
  else if (totalDPP <= 250_000_000)  rate = 0.15
  else if (totalDPP <= 500_000_000)  rate = 0.25
  else                               rate = 0.30

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

// ─── Number input helper ──────────────────────────────────────
export function parseNumericInput(val) {
  const cleaned = String(val).replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}
