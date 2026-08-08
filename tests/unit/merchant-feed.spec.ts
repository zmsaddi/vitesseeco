import { describe, expect, it } from 'vitest'
import { groupId } from '../../shared/product-group'

/**
 * Merchant Center reported this one itself: "[item_group_id] attribute text too
 * long", with the products served at limited visibility across Belgium, France
 * and the Netherlands. The longest value in the live feed was 98 characters
 * against a limit of 50 — model families are slugs, and some of ours are a
 * whole product title.
 */
describe('groupId', () => {
  const LONG = 'havena-ranger-fatbike-band-20x4-0-stevige-kwaliteit-met-anti-lek-laag-voor-elke-weersomstandigheid'

  it('passes a value that already fits through untouched', () => {
    // Most families are short, and rewriting them would regroup every product
    // in the account for no reason.
    expect(groupId('qmwheel-v20-pro-10-0')).toBe('qmwheel-v20-pro-10-0')
    expect(groupId('a'.repeat(50))).toBe('a'.repeat(50))
  })

  it('brings a long value inside Google’s limit', () => {
    expect(LONG.length).toBeGreaterThan(50)
    expect(groupId(LONG).length).toBeLessThanOrEqual(50)
  })

  it('gives the same family the same id every time', () => {
    // Colours of one model must land in one group, and the value must not move
    // between builds or Google would see the grouping change under it.
    expect(groupId(LONG)).toBe(groupId(LONG))
  })

  it('keeps families apart even when their slugs share a long prefix', () => {
    // The reason this is not a plain truncation. These two differ only at the
    // very end, and truncating would collapse them into one group — one
    // model's colours displayed under another model.
    const a = `${'ouxi-v8-elektrische-fatbike-dubbele-accu-zwart-versie'}-2024`
    const b = `${'ouxi-v8-elektrische-fatbike-dubbele-accu-zwart-versie'}-2025`
    expect(a.slice(0, 50)).toBe(b.slice(0, 50))
    expect(groupId(a)).not.toBe(groupId(b))
  })

  it('stays readable, so a human can still tell what a group is', () => {
    expect(groupId(LONG).startsWith('havena-ranger-fatbike-band-20x4-0')).toBe(true)
  })
})
