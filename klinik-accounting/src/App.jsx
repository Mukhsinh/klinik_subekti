import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import COAPage from './pages/accounting/COAPage'
import JournalPage from './pages/accounting/JournalPage'
import LedgerPage from './pages/accounting/LedgerPage'
import TrialBalancePage from './pages/accounting/TrialBalancePage'
import IncomeStatementPage from './pages/reports/IncomeStatementPage'
import BalanceSheetPage from './pages/reports/BalanceSheetPage'
import CashFlowPage from './pages/reports/CashFlowPage'
import InventoryPage from './pages/inventory/InventoryPage'
import GRNPage from './pages/inventory/GRNPage'
import StockLedgerPage from './pages/inventory/StockLedgerPage'
import BillingPage from './pages/billing/BillingPage'
import ExpensePage from './pages/ExpensePage'
import PPh21Page from './pages/tax/PPh21Page'
import PPNPage from './pages/tax/PPNPage'
import BranchesPage from './pages/BranchesPage'
import AppSettingsPage from './pages/settings/AppSettingsPage'
import UserManagementPage from './pages/settings/UserManagementPage'
import AuditTrailPage from './pages/settings/AuditTrailPage'
import DoctorManagementPage from './pages/settings/DoctorManagementPage'
import TarifLayananPage from './pages/settings/TarifLayananPage'
import VendorManagementPage from './pages/settings/VendorManagementPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes (AppLayout handles auth guard) */}
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="coa" element={<COAPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="trial-balance" element={<TrialBalancePage />} />
          <Route path="income-statement" element={<IncomeStatementPage />} />
          <Route path="balance-sheet" element={<BalanceSheetPage />} />
          <Route path="cash-flow" element={<CashFlowPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="grn" element={<GRNPage />} />
          <Route path="stock-ledger" element={<StockLedgerPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="expenses" element={<ExpensePage />} />
          <Route path="tax-pph21" element={<PPh21Page />} />
          <Route path="tax-ppn" element={<PPNPage />} />
          <Route path="branches" element={<BranchesPage />} />
          {/* Settings — admin only (access guard in AppLayout) */}
          <Route path="settings/app" element={<AppSettingsPage />} />
          <Route path="settings/users" element={<UserManagementPage />} />
          <Route path="settings/doctors" element={<DoctorManagementPage />} />
          <Route path="settings/service-tariffs" element={<TarifLayananPage />} />
          <Route path="settings/vendors" element={<VendorManagementPage />} />
          <Route path="settings/audit" element={<AuditTrailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
