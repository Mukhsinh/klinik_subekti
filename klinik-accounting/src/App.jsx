import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import COAPage from './pages/accounting/COAPage'
import OpeningBalancePage from './pages/accounting/OpeningBalancePage'
import JournalPage from './pages/accounting/JournalPage'
import LedgerPage from './pages/accounting/LedgerPage'
import TrialBalancePage from './pages/accounting/TrialBalancePage'
import IncomeStatementPage from './pages/reports/IncomeStatementPage'
import BalanceSheetPage from './pages/reports/BalanceSheetPage'
import CashFlowPage from './pages/reports/CashFlowPage'
import InventoryPage from './pages/inventory/InventoryPage'
import InventoryOpeningBalancePage from './pages/inventory/InventoryOpeningBalancePage'
import InventoryItemOpeningBalancePage from './pages/inventory/InventoryItemOpeningBalancePage'
import GRNPage from './pages/inventory/GRNPage'
import StockLedgerPage from './pages/inventory/StockLedgerPage'
import StockOutflowPage from './pages/inventory/StockOutflowPage'
import BillingPage from './pages/billing/BillingPage'
import BillingReportPage from './pages/reports/BillingReportPage'
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
import AssetInventoryPage from './pages/assets/AssetInventoryPage'
import AssetDepreciationPage from './pages/assets/AssetDepreciationPage'
import AssetMutationsPage from './pages/assets/AssetMutationsPage'
import AssetCardPage from './pages/assets/AssetCardPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes (AppLayout handles auth guard) */}
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="coa" element={<COAPage />} />
          <Route path="opening-balance" element={<OpeningBalancePage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="trial-balance" element={<TrialBalancePage />} />
          <Route path="income-statement" element={<IncomeStatementPage />} />
          <Route path="balance-sheet" element={<BalanceSheetPage />} />
          <Route path="cash-flow" element={<CashFlowPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/opening-balance" element={<InventoryOpeningBalancePage />} />
          <Route path="inventory/item-opening-balance" element={<InventoryItemOpeningBalancePage />} />
          <Route path="grn" element={<GRNPage />} />
          <Route path="stock-outflow" element={<StockOutflowPage />} />
          <Route path="stock-ledger" element={<StockLedgerPage />} />
          {/* Asset Management */}
          <Route path="assets/inventory" element={<AssetInventoryPage />} />
          <Route path="assets/depreciation" element={<AssetDepreciationPage />} />
          <Route path="assets/mutations" element={<AssetMutationsPage />} />
          <Route path="assets/card" element={<AssetCardPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="billing-report" element={<BillingReportPage />} />
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
