export const ACCOUNT_TYPES = ['banque', 'mobile_money', 'especes', 'epargne', 'autre'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  banque: 'Compte bancaire',
  mobile_money: 'Mobile money',
  especes: 'Espèces',
  epargne: 'Épargne',
  autre: 'Autre',
}

export const CATEGORY_KINDS = ['fixe', 'variable'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  fixe: 'Charge fixe',
  variable: 'Dépense variable',
}

export type Account = {
  id: string
  user: string
  name: string
  type: AccountType
  initial_balance: number
  color: string
  archived: boolean
}

export type Category = {
  id: string
  user: string
  name: string
  kind: CategoryKind
  parent: string
  active: boolean
  // CAT-04. Both may be empty: nothing back-filled the categories that existed
  // before the migration, so every read goes through lib/appearance.ts.
  icon: string
  color: string
}

/**
 * One row per category, counted by SQLite in the `category_usage` view. What
 * holds a category is asked of the database, never by pulling the thousands of
 * entries behind it into the browser. `id` is the category's own id.
 */
export type CategoryUsage = {
  id: string
  user: string
  transaction_count: number
  budget_count: number
  child_count: number
}

/** What the entry form offers; a transfer is written by its own server route. */
export const TRANSACTION_TYPES = ['depense', 'revenu'] as const
/** Transfers are recorded as two rows; the direction gives the balance its sign. */
export const TRANSFER_TYPES = ['virement_sortant', 'virement_entrant'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]
export type TransferType = (typeof TRANSFER_TYPES)[number]
export type EntryType = TransactionType | TransferType

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  depense: 'Dépense',
  revenu: 'Revenu',
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  ...TRANSACTION_TYPE_LABELS,
  virement_sortant: 'Virement sortant',
  virement_entrant: 'Virement entrant',
}

const CREDIT_TYPES: readonly string[] = ['revenu', 'virement_entrant']

/**
 * Types that add to a balance; everything else subtracts. The same rule is
 * written once more in SQL, inside the account_balances view — SQLite cannot
 * call this — so any change here has to be carried there too.
 */
export const isCredit = (type: string) => CREDIT_TYPES.includes(type)

export const isTransfer = (type: string) => (TRANSFER_TYPES as readonly string[]).includes(type)

/**
 * Narrows a stored entry to what the form can hold. The form offers two types
 * and a row carries four, so editing one needs the compiler to know the
 * difference rather than a cast that would silently accept a transfer leg.
 */
export const isTransactionType = (type: string): type is TransactionType =>
  (TRANSACTION_TYPES as readonly string[]).includes(type)

export type Transaction = {
  id: string
  user: string
  account: string
  category: string
  type: EntryType
  /** Always positive; `type` carries the direction. */
  amount: number
  date: string
  note: string
  transfer_group: string
  split_group: string
  /** When it was recorded, which is what the thirty-day edit window runs from. */
  created: string
  expand?: {
    account?: Account
    category?: Category
  }
}

/** Read-only view: the balance is computed in SQLite, never stored. */
export type AccountBalance = {
  id: string
  user: string
  balance: number
}

/** RAP-06's view: the run of consecutive days ending at the most recent entry. */
export type EntryStreak = {
  id: string
  user: string
  days: number
  last_day: string
}

export type Budget = {
  id: string
  user: string
  month: string
  category: string
  cap_amount: number
  carry_over: boolean
  carried_amount: number
  expand?: { category?: Category }
}

/** Read-only view: what each envelope has consumed, summed in SQLite. */
export type BudgetSpending = {
  id: string
  user: string
  category: string
  month: string
  spent: number
}

export const NOTIFICATION_TYPES = [
  'echeance_dette',
  'recurrente',
  'depassement_budget',
  'rappel_saisie',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type BudgetAlertPayload = { month: string; category: string; threshold: number }

export type DebtDuePayload = {
  debt: string
  creditor: string
  direction: DebtDirection
  dueDate: string
  daysAhead: number
  amount: number
}

/** The payload's shape follows the type; nothing else reads it. */
export type Notification =
  | (NotificationBase & { type: 'depassement_budget'; payload: BudgetAlertPayload })
  | (NotificationBase & { type: 'echeance_dette'; payload: DebtDuePayload })
  | (NotificationBase & { type: 'recurrente' | 'rappel_saisie'; payload: unknown })

type NotificationBase = {
  id: string
  user: string
  /** What it is about, as an exact key — `YYYY-MM@categoryId` for a budget. */
  subject: string
  due_at: string
  read: boolean
  created: string
}

/** Read-only view: the month's income and spending, summed in SQLite. */
export type MonthlySummary = {
  id: string
  user: string
  month: string
  income: number
  spent: number
}

export const DEBT_KINDS = [
  'pret_bancaire',
  'credit_conso',
  'familiale',
  'tontine',
  'decouvert',
  'autre',
] as const

export type DebtKind = (typeof DEBT_KINDS)[number]

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  pret_bancaire: 'Prêt bancaire',
  credit_conso: 'Crédit à la consommation',
  familiale: 'Dette familiale ou amicale',
  tontine: 'Tontine',
  decouvert: 'Découvert',
  autre: 'Autre',
}

/** DET-02: the module tracks what the user owes and what is owed to them. */
export const DEBT_DIRECTIONS = ['je_dois', 'on_me_doit'] as const

export type DebtDirection = (typeof DEBT_DIRECTIONS)[number]

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  je_dois: 'Je dois',
  on_me_doit: 'On me doit',
}

export type Debt = {
  id: string
  user: string
  creditor: string
  kind: DebtKind
  direction: DebtDirection
  initial_amount: number
  /** Written by the server, replayed from the payments — never adjusted. */
  remaining_amount: number
  interest_rate: number
  monthly_payment: number
  due_day: number
  start_date: string
  status: 'active' | 'soldee'
}

export type DebtPayment = {
  id: string
  user: string
  debt: string
  transaction: string
  amount: number
  /** Server-owned: the split depends on what was owed when it landed. */
  principal_part: number
  interest_part: number
  date: string
}
