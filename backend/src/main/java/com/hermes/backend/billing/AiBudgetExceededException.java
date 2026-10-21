package com.hermes.backend.billing;

public class AiBudgetExceededException extends IllegalStateException {
    public AiBudgetExceededException() { super("The AI service usage budget has been reached. Please try again later."); }
}
