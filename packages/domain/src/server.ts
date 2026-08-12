// Entry point bundled for PocketBase hooks. It runs under goja: ES5 only, no
// Intl, no fetch, no timers. Anything added here must survive that.
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
