// RAP-06: how many consecutive days, ending at the most recent one, carry at
// least one entry.
//
// It is counted here rather than in the browser because the dashboard loads no
// transactions at all. Counting client-side would mean fetching every date in
// the history on every open — the very thing dashboard-load.journey.tsx exists
// to forbid, and the reason the 74ms budget is worth measuring.
//
// The view says how long the run is and which day it ends on; it does not say
// whether that day is today. A view takes no parameter, so its only clock is
// SQLite's `date('now')`, which is UTC — and this repo already holds that the
// day belongs to the user's timezone (see todayLocally). So the timezone-
// sensitive half is left to the client, which knows its own date, and the
// expensive half — the runs of consecutive days — stays in SQLite.
//
// Every type of entry counts, transfers included: the requirement is about the
// habit of recording something, not about what the money did.
//
// CAST is not decoration: PocketBase cannot infer the type of an aggregate, and
// an uncast COUNT comes back as a JSON value that reads as zero (measured on
// budget_spending).
const ENTRY_STREAK = `
  WITH entry_days AS (
    SELECT DISTINCT transactions.user AS user, substr(transactions.date, 1, 10) AS day
    FROM transactions
  ),
  runs AS (
    SELECT
      entry_days.user AS user,
      entry_days.day AS day,
      CAST(julianday(entry_days.day) AS INT)
        - ROW_NUMBER() OVER (PARTITION BY entry_days.user ORDER BY entry_days.day) AS run
    FROM entry_days
  ),
  grouped AS (
    SELECT runs.user AS user, runs.run AS run, COUNT(*) AS length, MAX(runs.day) AS ends_on
    FROM runs
    GROUP BY runs.user, runs.run
  )
  SELECT
    grouped.user AS id,
    grouped.user AS user,
    CAST(grouped.length AS INT) AS days,
    grouped.ends_on AS last_day
  FROM grouped
  WHERE grouped.ends_on = (
    SELECT MAX(other.ends_on) FROM grouped AS other WHERE other.user = grouped.user
  )
`

migrate(
  (app) => {
    const view = new Collection({
      type: 'view',
      name: 'entry_streaks',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      viewQuery: ENTRY_STREAK,
    })

    app.save(view)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('entry_streaks'))
  },
)
