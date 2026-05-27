// .test.js sibling — exercises the same SQL-concat pattern intentionally.
// Should NOT emit a security finding (this is what the test is testing).
import { describe, it, expect } from 'vitest';

describe('SQL injection regression', () => {
  it('builds query string from input', () => {
    const id = "1' OR '1'='1";
    const sql = 'SELECT * FROM users WHERE id = ' + id;
    expect(sql).toBeTruthy();
  });
});
