// The history screen pages through entries ordered by `-date,-created`, and
// until now nothing indexed that order. The two existing indexes carry
// `account` and `category` in second position, so SQLite can only use their
// `user` prefix: with no account or category picked — the screen's default —
// it sorted the owner's whole history into a temp B-tree.
//
// That cost nothing while the list was fetched in one go, since the sort
// happened once. Paging repeats it for every page.
//
// Measured on 5 000 entries, at the query rather than through the screen:
// with this index, page 1 takes 3 ms and page 100 takes 2 ms — flat, because
// the index is walked rather than the history sorted. Without it, 6 ms then
// 9 ms, growing with depth. Both are small enough at this size that the screen
// answers in 77 ms either way; what the index buys is that the figure stays
// flat as the history grows, not a difference anyone can feel today.
//
// `id` is part of the index because it is part of the sort. Entries share a
// timestamp more often than one would guess — the seeded fixtures write them
// all at the same instant — and an ORDER BY with ties leaves their order to
// SQLite. In practice both pages take the same plan and come back consistent;
// `id` is carried so the order is total by construction rather than by luck of
// the plan, and being in the index it costs nothing.
//
// SQLite walks an index backwards as happily as forwards, so one ascending
// index serves the descending sort.
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.indexes = transactions.indexes.concat([
      'CREATE INDEX idx_transactions_user_date_created ON transactions (user, date, created, id)',
    ])

    app.save(transactions)
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId('transactions')

    transactions.indexes = transactions.indexes.filter(
      (index) => !index.includes('idx_transactions_user_date_created'),
    )

    app.save(transactions)
  },
)
