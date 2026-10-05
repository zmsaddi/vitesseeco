import { describe, expect, it } from 'vitest'
import { apiError } from '../../app/utils/apiError'

/** The body h3 actually sends for an AppError — the shape $fetch hands back as err.data. */
const h3Body = (payload: object) => ({
  error: true,
  url: '/api/auth/login',
  statusCode: 401,
  statusMessage: 'INVALID_CREDENTIALS',
  message: 'INVALID_CREDENTIALS',
  data: payload,
})

describe('reading an API error', () => {
  it('finds the payload h3 nests under the body', () => {
    const err = { data: h3Body({ code: 'INVALID_CREDENTIALS', messageKey: 'errors.invalid_credentials' }) }
    expect(apiError(err)).toEqual({ code: 'INVALID_CREDENTIALS', messageKey: 'errors.invalid_credentials' })
  })

  it('carries field issues and details through', () => {
    const issues = [{ path: 'email', message: 'errors.invalid_email' }]
    const err = { data: h3Body({ code: 'VALIDATION_FAILED', messageKey: 'errors.validation_failed', details: { issues } }) }
    expect(apiError(err).details?.issues).toEqual(issues)
  })

  it('still reads a flat payload, should a route ever send one', () => {
    expect(apiError({ data: { code: 'X', messageKey: 'errors.x' } }).messageKey).toBe('errors.x')
  })

  it('is empty for anything that never reached a route', () => {
    expect(apiError(new TypeError('Failed to fetch'))).toEqual({})
    expect(apiError({ data: '<html>502 Bad Gateway</html>' })).toEqual({})
    expect(apiError({ data: { statusCode: 500 } })).toEqual({})
    expect(apiError(null)).toEqual({})
  })
})
