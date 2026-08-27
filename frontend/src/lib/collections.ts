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
