// Three settings on `users`, all of them defaults PocketBase ships that this
// application cannot use as they stand.
//
// 1. The email-change template has the same defect the reset one had, fixed by
//    1786405596: it points at the admin UI rather than at the SPA, in English.
//    Any auth template left untouched will carry that defect.
//
// 2. OTP by email is the second factor. It is the only one PocketBase offers —
//    MFA here means two of its own methods, and there is no extension point
//    for an authenticator app. Building TOTP would mean HMAC-SHA1, which
//    $security does not have, and then bypassing this mechanism entirely.
//
// 3. MFA is enabled but gated by a rule, so it applies to whoever asks for it
//    rather than to everyone. The flag is a real column and not a path inside
//    the `settings` JSON: a filter on a JSON path matches nothing here, which
//    this repository has measured before.
const DEFAULT_CHANGE_SUBJECT = 'Confirm your {APP_NAME} new email address'

const DEFAULT_CHANGE_BODY =
  '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'

const CHANGE_SUBJECT = 'Confirmez votre nouvelle adresse {APP_NAME}'

const CHANGE_BODY =
  '<p>Bonjour,</p>\n<p>Vous avez demandé à utiliser cette adresse pour votre compte {APP_NAME}. Le changement ne prend effet qu\'après cette confirmation.</p>\n<p>\n  <a class="btn" href="{APP_URL}/confirm-email-change?token={TOKEN}" target="_blank" rel="noopener">Confirmer cette adresse</a>\n</p>\n<p><i>Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet e-mail : votre adresse actuelle reste inchangée.</i></p>\n<p>{APP_NAME}</p>'

const DEFAULT_OTP_SUBJECT = 'OTP for {APP_NAME}'

const OTP_SUBJECT = 'Votre code de connexion {APP_NAME}'

const OTP_BODY =
  "<p>Bonjour,</p>\n<p>Votre code de connexion est : <strong>{OTP}</strong></p>\n<p><i>Si vous n'essayez pas de vous connecter, ignorez cet e-mail et changez votre mot de passe.</i></p>\n<p>{APP_NAME}</p>"

/**
 * Whoever turned it on, and nobody else.
 *
 * An empty rule means EVERYONE, not nobody — measured on 31/08/2026 by
 * emptying it: signing up stopped working, because the sign-in that follows
 * registration met a challenge for an account that had never asked for one.
 * The rule is what keeps a second factor a choice instead of a wall.
 */
const MFA_RULE = 'mfa_enabled = true'

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.fields.add(
      new BoolField({
        name: 'mfa_enabled',
      }),
    )

    users.confirmEmailChangeTemplate.subject = CHANGE_SUBJECT
    users.confirmEmailChangeTemplate.body = CHANGE_BODY

    users.otp.enabled = true
    users.otp.emailTemplate.subject = OTP_SUBJECT
    users.otp.emailTemplate.body = OTP_BODY

    users.mfa.enabled = true
    users.mfa.rule = MFA_RULE

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.confirmEmailChangeTemplate.subject = DEFAULT_CHANGE_SUBJECT
    users.confirmEmailChangeTemplate.body = DEFAULT_CHANGE_BODY

    users.otp.enabled = false
    users.otp.emailTemplate.subject = DEFAULT_OTP_SUBJECT

    users.mfa.enabled = false
    users.mfa.rule = ''

    users.fields.removeByName('mfa_enabled')

    app.save(users)
  },
)
