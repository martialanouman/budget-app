// PocketBase keeps SMTP and the application URL in the database, not in flags.
// A container that comes up on an empty volume therefore serves with mail
// disabled and password-reset links pointing at localhost — the reset template
// builds its link from {APP_URL}.
//
// Reapplying them at every boot, rather than once in a migration, is what makes
// rotating the Resend API key a restart instead of a new migration file.
//
// This hook is deliberately not defensive. A production that cannot configure
// its mail starts with password recovery silently broken, which is worse than a
// container Dokploy shows as failing.
onBootstrap((e) => {
  e.next()

  const appURL = $os.getenv('APP_URL')
  const host = $os.getenv('SMTP_HOST')

  // Absent in development and under the journeys, where the harness points
  // PocketBase at Mailpit itself. Doing nothing is the point: this hook must
  // never overwrite a configuration it was not handed.
  if (!appURL && !host) return

  const settings = $app.settings()

  if (appURL) {
    settings.meta.appURL = appURL
  }

  const senderAddress = $os.getenv('SMTP_SENDER_ADDRESS')
  if (senderAddress) {
    // Checked here so the failure names the variable. PocketBase validates it
    // too, but its message — "meta: (senderAddress: must be a valid email
    // address.)" — says nothing about where the value came from, and this hook
    // is fatal by design: the operator reads that line inside a restart loop.
    // Measured on the first production deploy, 29/08/2026.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) {
      throw new Error(
        'SMTP_SENDER_ADDRESS is not an email address: "' +
          senderAddress +
          '". It must be a full address on a domain verified with the mail provider, ' +
          'such as budget@example.com. The display name belongs in SMTP_SENDER_NAME.',
      )
    }

    settings.meta.senderAddress = senderAddress
  }

  const senderName = $os.getenv('SMTP_SENDER_NAME')
  if (senderName) {
    settings.meta.senderName = senderName
  }

  if (host) {
    const port = parseInt($os.getenv('SMTP_PORT') || '465', 10)

    settings.smtp.enabled = true
    settings.smtp.host = host
    settings.smtp.port = port
    settings.smtp.username = $os.getenv('SMTP_USERNAME')
    settings.smtp.password = $os.getenv('SMTP_PASSWORD')
    // 465 carries TLS from the first byte; 587 negotiates it with STARTTLS.
    settings.smtp.tls = port === 465
  }

  $app.save(settings)
})
