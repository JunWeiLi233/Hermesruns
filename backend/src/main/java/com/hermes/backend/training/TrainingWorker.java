package com.hermes.backend.training;

import org.springframework.scheduling.annotation.Scheduled;

final class TrainingWorker {
    final TrainingJobs jobs;
    TrainingWorker(TrainingJobs jobs){this.jobs=jobs;}
    @Scheduled(fixedDelayString="${app.training-workspace.job-delay-ms:1000}")
    public void tick(){jobs.workOnce();}
}
