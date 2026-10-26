package com.hermes.backend.training;

public final class TrainingFailure extends RuntimeException {
    public final int status;
    public TrainingFailure(int status,String code) { super(code); this.status=status; }
    public static void check(boolean condition,int status,String code) { if(!condition) throw new TrainingFailure(status,code); }
}
