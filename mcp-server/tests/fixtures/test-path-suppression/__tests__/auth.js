// __tests__/ dir convention — should be suppressed.
const id = window.location.search;
const sql = 'SELECT * FROM users WHERE id = ' + id;
module.exports = { sql };
