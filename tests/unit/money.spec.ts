import { describe, expect, it } from 'vitest'
import {
  ZERO,
  MoneyError,
  add,
  allocate,
  allocateProportionally,
  applyPercentage,
  atLeastZero,
  cents,
  format,
  fromDecimalString,
  fromEuros,
  multiply,
  subtract,
  toDecimalString,
  toEuros,
} from '../../shared/money'

describe('cents', () => {
  it('accepts whole cents', () => {
    expect(cents(1999)).toBe(1999)
    expect(cents(0)).toBe(0)
  })

  it('rejects fractional cents — the whole point of the type', () => {
    expect(() => cents(19.99)).toThrow(MoneyError)
  })

  it('rejects NaN and Infinity', () => {
    expect(() => cents(Number.NaN)).toThrow(MoneyError)
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(MoneyError)
  })

  it('rejects absurd amounts', () => {
    expect(() => cents(100_000_001)).toThrow(MoneyError)
  })
})

describe('fromEuros', () => {
  it('converts the prices that break naive float maths', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754.
    expect(fromEuros(19.99)).toBe(1999)
    expect(fromEuros(1.005)).toBe(101)
    expect(fromEuros(0.1)).toBe(10)
    expect(fromEuros(950)).toBe(95000)
  })

  it('round-trips the whole catalogue price range without drift', () => {
    for (let euros = 0; euros <= 3000; euros += 0.01) {
      const rounded = Math.round(euros * 100) / 100
      expect(toEuros(fromEuros(rounded))).toBeCloseTo(rounded, 10)
    }
  })
})

describe('fromDecimalString', () => {
  it('parses the shapes an import file can contain', () => {
    expect(fromDecimalString('19.99')).toBe(1999)
    expect(fromDecimalString('19,99')).toBe(1999)
    expect(fromDecimalString('19.9')).toBe(1990)
    expect(fromDecimalString('19')).toBe(1900)
    expect(fromDecimalString(' 1249.00 ')).toBe(124900)
    expect(fromDecimalString('-5.50')).toBe(-550)
  })

  it('refuses anything ambiguous rather than guessing', () => {
    expect(() => fromDecimalString('19.999')).toThrow(MoneyError)
    expect(() => fromDecimalString('abc')).toThrow(MoneyError)
    expect(() => fromDecimalString('')).toThrow(MoneyError)
    expect(() => fromDecimalString('1 249.00')).toThrow(MoneyError)
  })
})

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(add(cents(1999), cents(1), cents(100))).toBe(2100)
    expect(subtract(cents(95000), cents(5000))).toBe(90000)
    expect(add()).toBe(0)
  })

  it('adds a hundred small amounts without drift', () => {
    const amounts = Array.from({ length: 100 }, () => fromEuros(0.1))
    expect(add(...amounts)).toBe(1000)
  })

  it('multiplies only by whole quantities', () => {
    expect(multiply(cents(95000), 3)).toBe(285000)
    expect(multiply(cents(95000), 0)).toBe(0)
    expect(() => multiply(cents(100), 1.5)).toThrow(MoneyError)
    expect(() => multiply(cents(100), -1)).toThrow(MoneyError)
  })
})

describe('applyPercentage', () => {
  it('rounds half up on the cent', () => {
    expect(applyPercentage(cents(1999), 10)).toBe(200)
    expect(applyPercentage(cents(95000), 15)).toBe(14250)
    expect(applyPercentage(cents(333), 50)).toBe(167)
  })

  it('handles the boundaries', () => {
    expect(applyPercentage(cents(1999), 0)).toBe(0)
    expect(applyPercentage(cents(1999), 100)).toBe(1999)
  })

  it('rejects impossible percentages', () => {
    expect(() => applyPercentage(cents(100), -1)).toThrow(MoneyError)
    expect(() => applyPercentage(cents(100), 101)).toThrow(MoneyError)
  })
})

describe('atLeastZero', () => {
  it('stops an oversized discount producing a negative total', () => {
    expect(atLeastZero(subtract(cents(1000), cents(1500)))).toBe(ZERO)
    expect(atLeastZero(cents(500))).toBe(500)
  })
})

describe('allocate', () => {
  it('never loses or invents a cent', () => {
    const parts = allocate(cents(1000), 3)
    expect(parts).toEqual([334, 333, 333])
    expect(add(...parts)).toBe(1000)
  })

  it('holds for every split of a hard amount', () => {
    for (let shares = 1; shares <= 25; shares++) {
      const parts = allocate(cents(9999), shares)
      expect(parts).toHaveLength(shares)
      expect(add(...parts)).toBe(9999)
    }
  })

  it('handles negative amounts symmetrically', () => {
    expect(add(...allocate(cents(-1000), 3))).toBe(-1000)
  })

  it('rejects a non-positive share count', () => {
    expect(() => allocate(cents(100), 0)).toThrow(MoneyError)
  })
})

describe('allocateProportionally', () => {
  it('splits a basket discount by line value and still sums exactly', () => {
    const parts = allocateProportionally(cents(1000), [cents(95000), cents(5000)])
    expect(add(...parts)).toBe(1000)
    expect(parts[0]).toBeGreaterThan(parts[1] as number)
  })

  it('sums exactly across many awkward weight sets', () => {
    const weightSets = [
      [cents(1), cents(1), cents(1)],
      [cents(99999), cents(1)],
      [cents(333), cents(333), cents(334)],
      [cents(0), cents(0), cents(100)],
    ]
    for (const weights of weightSets) {
      expect(add(...allocateProportionally(cents(777), weights))).toBe(777)
    }
  })

  it('falls back to an even split when every weight is zero', () => {
    expect(add(...allocateProportionally(cents(100), [ZERO, ZERO]))).toBe(100)
  })

  it('returns nothing for no lines', () => {
    expect(allocateProportionally(cents(100), [])).toEqual([])
  })
})

describe('presentation', () => {
  it('renders a canonical decimal string', () => {
    expect(toDecimalString(cents(124900))).toBe('1249.00')
    expect(toDecimalString(cents(5))).toBe('0.05')
    expect(toDecimalString(cents(-550))).toBe('-5.50')
  })

  it('formats per locale', () => {
    // Normalise the non-breaking spaces Intl inserts.
    const fr = format(cents(124900), 'fr-FR').replace(/ | /g, ' ')
    expect(fr).toBe('1 249,00 €')
    const de = format(cents(124900), 'de-DE').replace(/ | /g, ' ')
    expect(de).toBe('1.249,00 €')
  })
})
