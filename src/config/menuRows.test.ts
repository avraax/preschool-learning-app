import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balancedRows } from './menuRows.ts'

test('the door menus\' real counts split the way the PRD promises', () => {
  assert.deepEqual(balancedRows(9, 5), [5, 4]) // Farver og Krea on an iPad
  assert.deepEqual(balancedRows(8, 5), [4, 4]) // Tal with Fyld Båden
  assert.deepEqual(balancedRows(7, 5), [4, 3]) // Tal on production
  assert.deepEqual(balancedRows(5, 5), [5]) // Bogstaver og Ord
  assert.deepEqual(balancedRows(3, 5), [3]) // Engelsk
  assert.deepEqual(balancedRows(9, 3), [3, 3, 3]) // narrow: Split View, phone portrait
  assert.deepEqual(balancedRows(8, 3), [3, 3, 2])
  assert.deepEqual(balancedRows(9, 4), [3, 3, 3])
})

test('never an orphan, never over the cap, always the whole count', () => {
  for (let n = 1; n <= 20; n++) {
    for (let cap = 1; cap <= 8; cap++) {
      const rows = balancedRows(n, cap)
      assert.equal(rows.reduce((a, b) => a + b, 0), n)
      assert.ok(rows.every((r) => r <= cap && r >= 1))
      assert.ok(Math.max(...rows) - Math.min(...rows) <= 1, `${n}@${cap}: ${rows}`)
      assert.equal(rows.length, Math.ceil(n / cap), 'more rows than the width needs')
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i] <= rows[i - 1], 'longer rows first')
    }
  }
  assert.deepEqual(balancedRows(0, 5), [])
})
