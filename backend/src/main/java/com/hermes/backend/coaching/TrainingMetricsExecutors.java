package com.hermes.backend.coaching;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Where training metrics are computed off the request thread: one thread for the small work that follows
 * each new run, and one for the long walks over a runner's history, so a big recompute cannot hold up the
 * numbers for a run that was just imported.
 *
 * <p>Work that does not fit in a queue is dropped, not run on the caller's thread. That is safe because a
 * run's metrics are also computed when the run is opened, and a restart catches up on runs that have none.</p>
 *
 * <p>With {@code app.training.async=false} (the tests) everything runs on the caller's thread, so results
 * are there when the call returns.</p>
 */
@Component
class TrainingMetricsExecutors {

    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsExecutors.class);
    private static final int QUEUE_CAPACITY = 2000;

    private final Executor ingest;
    private final Executor bulk;
    private final ThreadPoolExecutor ingestPool;
    private final ThreadPoolExecutor bulkPool;

    TrainingMetricsExecutors(@Value("${app.training.async:true}") boolean async) {
        if (async) {
            ingestPool = pool("training-metrics-ingest");
            bulkPool = pool("training-metrics-bulk");
            ingest = ingestPool;
            bulk = bulkPool;
        } else {
            ingestPool = null;
            bulkPool = null;
            ingest = Runnable::run;
            bulk = Runnable::run;
        }
    }

    private static ThreadPoolExecutor pool(String name) {
        RejectedExecutionHandler dropAndSay = (task, executor) ->
                log.warn("{} queue is full; dropping a task (it is recomputed when the run is opened)", name);
        ThreadPoolExecutor pool = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(QUEUE_CAPACITY),
                runnable -> {
                    Thread thread = new Thread(runnable, name);
                    thread.setDaemon(true);
                    return thread;
                },
                dropAndSay);
        return pool;
    }

    /** Runs the small work that follows one new or changed run. */
    void ingest(Runnable work) {
        ingest.execute(work);
    }

    /** Runs a long walk over a runner's runs. */
    void bulk(Runnable work) {
        bulk.execute(work);
    }

    @PreDestroy
    void shutdown() {
        if (ingestPool != null) {
            ingestPool.shutdownNow();
        }
        if (bulkPool != null) {
            bulkPool.shutdownNow();
        }
    }
}
