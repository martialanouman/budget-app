// CAT-04. A category gets an icon and a colour, so a row in a list is
// recognisable at a glance rather than read word by word — which is what the
// history screen asks of a thumb on a phone.
//
// Both are plain text and both may be empty. Nothing back-fills the categories
// that already exist, and a required field would have made this migration fail
// on every one of them; the interface derives an appearance from the name when
// the value is blank, so no category is ever without one.
//
// `icon` holds one emoji. The width is in characters, and an emoji is rarely
// one: a family (👪) or a flag is several code points joined together, so 16
// leaves room for the compound ones without inviting a sentence.
//
// `color` holds a PALETTE KEY — "terracotta", "indigo" — never a hex. A colour
// chosen against the light theme can disappear against the dark one, and the
// key is what lets the stylesheet answer for both. Same width as accounts.color,
// which has held a key-shaped value since step 3 without ever being written to.
migrate(
  (app) => {
    const categories = app.findCollectionByNameOrId('categories')

    categories.fields.add(new TextField({ name: 'icon', max: 16 }))
    categories.fields.add(new TextField({ name: 'color', max: 20 }))

    app.save(categories)
  },
  (app) => {
    const categories = app.findCollectionByNameOrId('categories')

    categories.fields.removeByName('icon')
    categories.fields.removeByName('color')

    app.save(categories)
  },
)
