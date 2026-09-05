package com.hermes.backend.races.model;

public enum PromptRaceType {
    POINT_TO_POINT("point-to-point"), LOOP("loop"), OUT_AND_BACK("out-and-back");
    private final String promptValue;
    PromptRaceType(String promptValue) { this.promptValue = promptValue; }
    public String promptValue() { return promptValue; }
}
