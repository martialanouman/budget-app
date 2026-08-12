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

export const TRANSACTION_TYPES = ['depense', 'revenu'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  depense: 'Dépense',
  revenu: 'Revenu',
}

export type Transaction = {
  id: string
  user: string
  account: string
  category: string
  type: TransactionType
  /** Always positive; `type` carries the direction. */
  amount: number
  date: string
  note: string
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
