import { afterEach, beforeEach, expect, it } from 'vitest'
import { installTheme, readThemePreference, setThemePreference } from './theme.ts'

/**
 * The theme is the one module of this application that writes to `document`
 * from outside React, so nothing else can catch it going wrong. Both defects
 * these tests pin were found by reading, not by running — which is the whole
 * argument for their existence.
 *
 * A journey rather than a domain scenario: `localStorage`, `<html>` and the
 * `storage` event are the subject, and none of them exist under node.
 */
const STORAGE_KEY = 'kalpe:theme'

const themeAttribute = () => document.documentElement.getAttribute('data-theme')

const overrideMeta = () => document.head.querySelector('#theme-color-override')

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute('data-theme')
  overrideMeta()?.remove()
})

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  document.documentElement.removeAttribute('data-theme')
  overrideMeta()?.remove()
})

it('leaves the system in charge when nothing has been chosen', () => {
  installTheme()

  expect(readThemePreference()).toBe('system')
  // No attribute at all, so the media query in the stylesheet decides. An
  // attribute of "system" would match neither block and pin the light palette.
  expect(themeAttribute()).toBeNull()
  expect(overrideMeta()).toBeNull()
})

it('applies a stored choice at start-up, before anything renders', () => {
  localStorage.setItem(STORAGE_KEY, 'dark')

  installTheme()

  expect(themeAttribute()).toBe('dark')
})

it('ignores a stored value that is not a preference', () => {
  localStorage.setItem(STORAGE_KEY, 'midnight')

  installTheme()

  expect(readThemePreference()).toBe('system')
  expect(themeAttribute()).toBeNull()
})

it('remembers an explicit choice and forgets it again on returning to system', () => {
  setThemePreference('light')
  expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
  expect(themeAttribute()).toBe('light')

  setThemePreference('system')
  // Removed rather than stored as "system": a browser whose default changes
  // should follow it, and a leftover value would freeze the old answer.
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  expect(themeAttribute()).toBeNull()
})

/**
 * The browser takes the FIRST `theme-color` tag whose media matches, and a tag
 * without media always matches. Placed anywhere but first, the override would
 * lose to the media-scoped pair that index.html ships.
 */
it('puts the colour override ahead of the media-scoped tags', () => {
  const media = document.createElement('meta')
  media.setAttribute('name', 'theme-color')
  media.setAttribute('media', '(prefers-color-scheme: light)')
  media.setAttribute('content', '#ffffff')
  document.head.append(media)

  setThemePreference('dark')

  const tags = [...document.head.querySelectorAll('meta[name="theme-color"]')]
  expect(tags[0]?.id).toBe('theme-color-override')
  expect(tags[0]?.getAttribute('content')).toBe('#201c17')
  expect(tags[0]?.hasAttribute('media')).toBe(false)

  setThemePreference('system')
  // Back to the system, the media pair must be alone again — an override left
  // behind would outrank them for ever.
  expect(overrideMeta()).toBeNull()

  media.remove()
})

/**
 * Two tabs are two module instances. The listener that carries a choice from
 * one to the other lived inside `subscribe`, so it only existed while some
 * component happened to be mounted: switching to dark on the settings screen
 * left a dashboard open in another tab on the light palette until reload.
 */
it('follows a choice made in another tab without a component mounted', () => {
  installTheme()
  expect(themeAttribute()).toBeNull()

  localStorage.setItem(STORAGE_KEY, 'dark')
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'dark' }))

  expect(themeAttribute()).toBe('dark')
})

it('ignores a storage event about something else entirely', () => {
  installTheme()

  localStorage.setItem('pocketbase_auth', '{}')
  window.dispatchEvent(new StorageEvent('storage', { key: 'pocketbase_auth', newValue: '{}' }))

  expect(themeAttribute()).toBeNull()

  localStorage.removeItem('pocketbase_auth')
})
