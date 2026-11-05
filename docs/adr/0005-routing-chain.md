# 0005 — Routing chain

**Decision.** The `route` function tries OpenRouteService (with a key), then
the public OSM servers of FOSSGIS (no key, one request a second, own
User-Agent, attribution), then a straight line that the app marks as an
estimate. One try per provider, cache by ~110 m cells, a daily quota per user.

**Consequences.** Routes work without any key; heavy or commercial use needs
a key or a self-hosted OSRM (FOSSGIS terms). docs/route.md.
