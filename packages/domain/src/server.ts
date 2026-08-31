export {
  type Instalment,
  type Terms,
  amortisationSchedule,
  daysUntil,
  instalmentDueDate,
  nextDueDate,
  splitPayment,
} from './debt.ts'
export {
  BUDGET_THRESHOLDS,
  type BudgetThreshold,
  reachedThresholds,
  remainingToLive,
  unspent,
} from './budget.ts'
// Entry point bundled for PocketBase hooks. It runs under goja, which accepts
// most of ES2015 but has no Intl, no fetch and no timers. Anything added here
// must survive that — re-exporting ./format.ts would crash the hooks at load.
export {
  InvalidAmountError,
  type Money,
  ZERO,
  addMoney,
  allocate,
  parseAmount,
  subtractMoney,
  toMoney,
} from './money.ts'
export { EDIT_WINDOW_DAYS, remainsEditable } from './entry-window.ts'
