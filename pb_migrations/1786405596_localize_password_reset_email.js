// PocketBase's default reset link points at its own admin UI
// ({APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}), which is not where our
// users should land. Point it at the SPA route instead, in French like the
// rest of the interface.
const DEFAULT_SUBJECT = 'Reset your {APP_NAME} password'

const DEFAULT_BODY =
  '<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn\'t ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'

const SUBJECT = 'Réinitialisation de votre mot de passe {APP_NAME}'

const BODY =
  '<p>Bonjour,</p>\n<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>\n<p>\n  <a class="btn" href="{APP_URL}/reset-password?token={TOKEN}" target="_blank" rel="noopener">Choisir un nouveau mot de passe</a>\n</p>\n<p><i>Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet e-mail.</i></p>\n<p>{APP_NAME}</p>'

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.resetPasswordTemplate.subject = SUBJECT
    users.resetPasswordTemplate.body = BODY

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.resetPasswordTemplate.subject = DEFAULT_SUBJECT
    users.resetPasswordTemplate.body = DEFAULT_BODY

    app.save(users)
  },
)
