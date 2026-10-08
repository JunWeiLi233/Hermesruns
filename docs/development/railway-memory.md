# Always-on Railway memory profile

The web service stays online. The image uses G1 with a 60-second periodic GC
interval so unused heap can be reclaimed after imports without sleeping the
container. The initial heap remains 64 MiB, maximum heap 640 MiB, and maximum
metaspace 192 MiB. The previous 128 MiB metadata cap was exhausted by full
catalog initialization in a longer local run. A higher ceiling does not
preallocate that memory. Two parallel GC workers and one concurrent worker bound the
collector's overhead. `JAVA_OPTS` remains an overridable deployment setting.

## Verification

Run `node tools/railway-deployment-contract.smoke.test.mjs` and
`node tools/railway-jvm-runtime.smoke.test.mjs`. The latter checks the actual
JVM's option parser and requires Java to be installed. Set `JAVA_MEMORY_TEST_BIN` to a
specific Java executable to require that runtime, including Java 25.

A controlled Java 25.0.4.1 Windows comparison used the same packaged application,
three synthetic users, and a 13.7 MB GPX file with 140,000 input points. The
existing import limit retained 70,000 points. Other users continued requesting
their dashboards during the import. The database was an isolated H2 file with
a 2 MiB page cache and the `sleep` Spring profile; no production data or
credentials were used. This profile affects background polling, not the
Railway Serverless setting. Both controlled runs used 192 MiB metadata
headroom and disabled external catalog fetching only in the local fixture.
Production catalog behavior is unchanged.

| Profile | Process RAM after 210 s idle | API median / p95 after idle | Import time |
| --- | ---: | ---: | ---: |
| Serial, 640 MiB heap ceiling | 672.0 MiB | 2.6 / 85.9 ms | 2,158 ms |
| Periodic G1, 640 MiB ceiling | 484.9 MiB | 2.9 / 99.7 ms | 2,340 ms |

The 640 MiB ceiling preserves peak import headroom. An initial 90-second trial
with a 512 MiB ceiling saved only about 20 MiB more, so the ceiling was retained.
Median responses stayed comparable; the post-idle burst's p95 was higher in
the G1 run. These single-run timings are not a statistical no-regression claim.
The separate 300-second test with catalog startup fetching enabled remained
healthy, reclaimed process RAM to 426.6 MiB, and served the post-observation
API burst at 2.4 ms median / 7.9 ms p95. Metadata usage reached 128.1 MiB,
confirming the need for headroom above the former 128 MiB ceiling.
These Windows process-memory measurements establish a local comparison, not a
Linux production RAM value or a guaranteed future bill. Verify the deployment
health, live Railway memory/CPU graphs, and billing projection after rollout.

RAM is charged by actual usage, not the heap ceiling or replica resource limit.
The $5 Hobby subscription floor remains even when resource usage is lower.
Keep the service's Serverless setting disabled for 24/7 readiness. A hard spend
limit can shut the service down, so use an alert when availability is required.

For a runtime-only rollout on the existing Serial image, remove the newly
added `JAVA_OPTS` override if the previous deployment used only its image
defaults. If an override existed, restore that previous value. Redeploy the
existing source and verify health again.

After an image containing the changed Dockerfile is deployed, removing the
override still leaves G1 enabled. Roll back to the previous image or explicitly
restore the previously recorded option set instead. Keep the rollout method
and baseline image separate when planning rollback.

References: [Railway pricing](https://docs.railway.com/pricing/plans),
[Java 25 G1 periodic collections](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html).
