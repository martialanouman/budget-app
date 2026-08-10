// PocketBase ships a default `users` auth collection whose access rules already
// restrict every record to its owner. This migration only closes the two gaps
// with the specs: a settings holder, and the 10 character password floor.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.fields.add(
      new JSONField({
        name: 'settings',
        maxSize: 100000,
      }),
    )

    users.fields.getByName('password').min = 10

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    users.fields.removeByName('settings')
    users.fields.getByName('password').min = 8

    app.save(users)
  },
)
