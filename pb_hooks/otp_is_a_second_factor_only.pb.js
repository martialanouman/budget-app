// USR-09. The one-time code is the SECOND half of a sign-in, never the whole
// of it.
//
// Enabling `otp` on the collection was needed to give MFA a second method to
// ask for, but OTP in PocketBase is a full authentication method in its own
// right: `mfa.rule` makes a second method mandatory for the records it matches
// and does nothing to stop the first from being the code itself. Since
// `mfa_enabled` defaults to false, that handed every account a sign-in needing
// no password at all — silently, unlike a password reset, which rotates the
// password and drops every session so the owner notices.
//
// A challenge issued by `authWithPassword` carries an `mfaId`, and the SDK
// sends it as a query parameter. Its absence is precisely what says "this code
// is being offered on its own", so that is what is refused.
onRecordAuthWithOTPRequest((e) => {
  const query = e.requestInfo().query

  if (!query || !query.mfaId) {
    throw new BadRequestError(
      'A one-time code can only complete a sign-in that began with a password.',
    )
  }

  e.next()
}, 'users')
