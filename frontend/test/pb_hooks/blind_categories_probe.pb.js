// Withholds the category list from one marked account.
//
// The dashboard's breakdown has to wait for the names before it draws anything:
// without them every row falls back to "Sans catégorie" and every arc to the
// single hue derived from that one string, so a ring of five categories comes
// out as one solid colour. In an ordinary run that state is a race between two
// real queries — it lasts a few milliseconds and no assertion can pin it — so
// one of the two is made to fail on purpose instead.
//
// Only for addresses beginning with "blindcat", and only for requests that do
// not carry the seeding header, so the journey can still read the categories it
// needs in order to write its transactions.
//
// Harness only — the file never leaves this directory.
onRecordsListRequest((e) => {
  const email = e.auth ? e.auth.getString('email') : ''
  const seeding = e.requestInfo().headers['x_probe_seed'] === '1'

  if (email.indexOf('blindcat') === 0 && !seeding) {
    throw new BadRequestError('categories withheld from this probe')
  }

  e.next()
}, 'categories')
