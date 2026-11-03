/**
 * Simulated Supabase Realtime (Phoenix protocol, vsn 2.0.0: messages are
 * [join_ref, ref, topic, event, payload]) on Playwright's routeWebSocket:
 * joins, heartbeats and leaves are answered, and `emit` delivers an INSERT
 * to every channel listening to that table, as Postgres Changes would.
 */
export function createRealtime() {
  /** topic → { ws, joinRef, bindings: [{ id, table }] } */
  const channels = new Map();
  let nextId = 1;

  const send = (ws, message) => ws.send(JSON.stringify(message));

  function onMessage(ws, raw) {
    const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
    if (topic === 'phoenix' && event === 'heartbeat') return send(ws, [null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} }]);
    if (event === 'phx_join') {
      const wanted = payload?.config?.postgres_changes ?? [];
      const bindings = wanted.map((b) => ({ id: nextId++, event: b.event, schema: b.schema, table: b.table, filter: b.filter }));
      channels.set(topic, { ws, joinRef, bindings });
      send(ws, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: bindings } }]);
      send(ws, [joinRef, null, topic, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', extension: 'postgres_changes', channel: topic }]);
      return;
    }
    if (event === 'phx_leave') {
      channels.delete(topic);
      return send(ws, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
    }
    if (ref) send(ws, [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
  }

  return {
    /** Playwright: context.routeWebSocket(/realtime/, realtime.route). */
    route: (ws) => ws.onMessage((message) => onMessage(ws, message)),
    /** Delivers an INSERT of `table` (ids only, like the event tables). */
    emit(table, record) {
      for (const [topic, channel] of channels) {
        const ids = channel.bindings.filter((b) => b.table === table).map((b) => b.id);
        if (!ids.length) continue;
        send(channel.ws, [null, null, topic, 'postgres_changes', {
          ids,
          data: { schema: 'public', table, commit_timestamp: new Date().toISOString(), type: 'INSERT', record, columns: [], errors: null },
        }]);
      }
    },
    /** How many channels are joined for a table (to wait for a screen to listen). */
    listening: (table) => [...channels.values()].filter((c) => c.bindings.some((b) => b.table === table)).length,
  };
}
