// Test-only hook. It proves the shared domain bundle is loadable and runnable
// by PocketBase's goja engine, so the production hooks of later steps can rely
// on it. It is never copied into a deployed pb_hooks directory.
routerAdd('GET', '/api/_test/domain', (e) => {
  try {
    const domain = require(`${__hooks}/lib/domain.cjs`)

    return e.json(200, {
      parts: domain.allocate(domain.toMoney(100), [1, 1, 1]),
      parsed: domain.parseAmount('150 000'),
      sum: domain.addMoney(domain.toMoney(2000), domain.toMoney(500)),
    })
  } catch (err) {
    // "message", not "error": the PocketBase SDK builds ClientResponseError
    // from data.message, and would drop anything under another key — losing
    // the very diagnostic this catch exists to surface.
    return e.json(500, { message: `Domain bundle failed under goja: ${String(err)}` })
  }
})
