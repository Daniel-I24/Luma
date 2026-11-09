/**
 * The small part of PostgREST the e2e tests need, over in-memory tables:
 * eq / in / is / neq / gte / lte filters, order, limit, HEAD counts, single
 * objects (Accept: vnd.pgrst.object) and simple writes. Unknown tables are
 * reported by the backend as unhandled, never answered by guess.
 */

/** Rows of `table` that match the query string filters. */
export function select(rows, params) {
  let out = rows.filter((row) => matches(row, params));
  const order = params.get('order');
  if (order) {
    const [column, direction] = order.split(',')[0].split('.');
    out = [...out].sort((a, b) => compare(a[column], b[column]) * (direction === 'desc' ? -1 : 1));
  }
  const limit = Number(params.get('limit'));
  return limit > 0 ? out.slice(0, limit) : out;
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (key === 'or' || key === 'and') continue;
    const [op, ...rest] = raw.split('.');
    const value = rest.join('.');
    const cell = row[key];
    if (!test(op, cell, value)) return false;
  }
  return true;
}

function test(op, cell, value) {
  switch (op) {
    case 'eq': return String(cell) === value;
    case 'neq': return String(cell) !== value;
    case 'is': return value === 'null' ? cell === null || cell === undefined : String(cell) === value;
    case 'in': return value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')).includes(String(cell));
    case 'gte': return compare(cell, value) >= 0;
    case 'gt': return compare(cell, value) > 0;
    case 'lte': return compare(cell, value) <= 0;
    case 'lt': return compare(cell, value) < 0;
    case 'not': return true;
    default: return true;
  }
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  // Numbers as numbers: as text, -77.28 sorts before -77.38 and no business was ever "nearby".
  if (typeof a === 'number') return a - Number(b);
  return String(a) < String(b) ? -1 : 1;
}

/** Applies a PATCH to the matching rows; resolves to them. */
export function update(rows, params, patch) {
  const changed = rows.filter((row) => matches(row, params));
  for (const row of changed) Object.assign(row, patch, { updated_at: new Date().toISOString() });
  return changed;
}

/** Removes the matching rows; resolves to them. */
export function remove(table, params) {
  const gone = table.filter((row) => matches(row, params));
  for (const row of gone) table.splice(table.indexOf(row), 1);
  return gone;
}
