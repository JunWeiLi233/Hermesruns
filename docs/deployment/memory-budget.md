# Memory Budget

The default JVM retains its 640 MB peak heap capacity and 128 MB metaspace cap.
Serial GC targets 5-10% free space after collection, and ShrinkHeapInSteps is
disabled so unused heap can be returned in one collection rather than several.
This reduces retained memory after startup or traffic bursts; collection can
run more often, so compare latency and CPU under representative traffic.

The local response cache has a 16 MiB estimated-memory budget in addition to its
entry and per-value limits. Accounting includes a UTF-16 upper bound for both
keys and serialized values plus per-entry overhead. It is not a process RSS cap.
Expired entries are removed before fresh least-recently-used entries are evicted.
Oversized replacements remove the old value, and Redis writes remain enabled
when Redis is configured. Cache misses use the existing data-loading paths.

Override the cache budget with APP_CACHE_LOCAL_MAX_TOTAL_BYTES (positive bytes).
JAVA_OPTS can override the JVM flags. To roll back heap reclamation behavior,
restore MinHeapFreeRatio=20, MaxHeapFreeRatio=40 and omit -XX:-ShrinkHeapInSteps.
Keep production,sleep enabled and verify actual Railway idle/sleep transitions.
Database memory is a separate cost; do not change PostgreSQL limits without
measuring its workload and preserving its configuration and data.
