/**
 * A suite that skipped is not a suite that passed.
 *
 * The integration tests skip rather than fail when `TEST_DATABASE_URL` is
 * absent — deliberately, so a developer without a database can still run
 * `npm run test`. In CI that same kindness is a trap: without the variable the
 * job reports
 *
 *     Test Files  7 skipped (7)
 *          Tests  101 skipped (101)
 *
 * and exits 0. A green tick, 101 tests proving nothing, and the money and stock
 * paths unguarded.
 *
 * The previous guard against this ran the whole suite a SECOND time and grepped
 * the output — a minute of CI to learn what the first run already knew. Vitest
 * writes a JSON report; this reads it.
 *
 *   npm run test:integration -- --reporter=json --outputFile=report.json
 *   node scripts/assert-suite-ran.mjs report.json 101
 *
 * The second argument is the minimum number of tests that must have PASSED.
 * Pass a real number, not 1: a suite that quietly loses six files still clears
 * a floor of one.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'

const [, , reportPath, minimum = '1'] = process.argv

if (!reportPath) {
  console.error('usage: node scripts/assert-suite-ran.mjs <report.json> [minimum-passed]')
  process.exit(2)
}

let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (error) {
  console.error(`❌ could not read ${reportPath}: ${error.message}`)
  console.error('   The run produced no report, which means it did not get far enough to write one.')
  process.exit(1)
}

const passed = report.numPassedTests ?? 0
const skipped = report.numPendingTests ?? 0
const total = report.numTotalTests ?? 0
const floor = Number.parseInt(minimum, 10)

const problems = []
if (!report.success) problems.push('the run reported failure')
if (skipped > 0) problems.push(`${skipped} test(s) were skipped — the environment they need was missing`)
if (passed < floor) problems.push(`only ${passed} test(s) passed, fewer than the expected ${floor}`)

if (problems.length > 0) {
  console.error(`❌ ${reportPath}: ${total} test(s) collected, ${passed} passed, ${skipped} skipped`)
  for (const problem of problems) console.error(`   ${problem}`)
  process.exit(1)
}

console.log(`✅ ${passed} test(s) executed and passed, none skipped`)
