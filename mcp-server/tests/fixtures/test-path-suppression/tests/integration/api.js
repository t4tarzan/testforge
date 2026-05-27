// tests/ dir convention — should be suppressed.
function buildLookup(input) {
  return 'SELECT * FROM things WHERE name = ' + input;
}
module.exports = { buildLookup };
