package com.hermes.backend.runner;

/** Optional domain-owned JSON entry in an authenticated account export. No credentials belong here. */
public interface RunnerDataExportContributor {
    String filename();
    Object export(Runner runner);
}
