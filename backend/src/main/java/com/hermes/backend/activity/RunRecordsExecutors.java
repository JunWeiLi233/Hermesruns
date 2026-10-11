package com.hermes.backend.activity;

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
 * Where the run analysis (best efforts and routes) is done off the request thread: one thread for the small work that
 * follows each new run, and one for the long walk over a history, so catching up cannot hold up the records of a run that
 * was just imported.
 *
 * <p>Work that does not fit in a queue is dropped, not run on the caller's thread. That is safe because a run is also
 * analysed when its records are read and again after every start.</p>
 *
 * <p>With {@code app.records.async=false} (the tests) everything runs on the caller's thread, so results are there when
 * the call returns.</p>
 */
@Component
class RunRecordsExecutors {

    private static final Logger log = LoggerFactory.getLogger(RunRecordsExecutors.class);
    private static final int QUEUE_CAPACITY = 2000;

    private final Executor ingest;
    private final Executor bulk;
    private final ThreadPoolExecutor ingestPool;
    private final ThreadPoolExecutor bulkPool;

    RunRecordsExecutors(@Value("${app.records.async:true}") boolean async) {
        if (async) {
            ingestPool = pool("run-records-ingest");
            bulkPool = pool("run-records-bulk");
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
                log.warn("{} queue is full; dropping a task (it is analysed when its records are read)", name);
        return new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(QUEUE_CAPACITY),
                runnable -> {
                    Thread thread = new Thread(runnable, name);
                    thread.setDaemon(true);
                    return thread;
                },
                dropAndSay);
    }

    /** Runs the small work that follows one new or changed run. */
    void ingest(Runnable work) {
        ingest.execute(work);
    }

    /** Runs a long walk over runs. */
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
