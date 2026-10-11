package com.hermes.backend.activity;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The rules for a run's tags and its run type, with no database in the way. */
class RunLabelRulesTests {

    @Test
    void aTagIsTrimmedAndItsInnerSpacesAreCollapsed() {
        assertThat(RunLabelService.tidy("  hill   repeats  ")).isEqualTo("hill repeats");
        assertThat(RunLabelService.tidy("with\tthe dog")).isEqualTo("with the dog");
        assertThat(RunLabelService.tidy("a b")).isEqualTo("a b");
        assertThat(RunLabelService.tidy("   ")).isEmpty();
    }

    @Test
    void controlCharactersAreDroppedAndEverythingElseKept() {
        assertThat(RunLabelService.tidy("tr\u0000ea\u0007dmill\u001B")).isEqualTo("treadmill");
        assertThat(RunLabelService.tidy("5K 🏃 跑步 café")).isEqualTo("5K 🏃 跑步 café");
    }

    @Test
    void aTagIsComposedSoTwoWaysOfWritingAnAccentAreOneTag() {
        String composed = "café";
        String decomposed = "café";
        assertThat(RunLabelService.tidy(decomposed)).isEqualTo(composed);
        assertThat(RunLabelService.cleanTags(List.of(composed, decomposed))).containsExactly(composed);
    }

    @Test
    void theSameWordInAnotherCaseIsOneTagAndTheFirstSpellingStays() {
        assertThat(RunLabelService.cleanTags(List.of("Hills", "treadmill", "HILLS", "hills "))).containsExactly("Hills", "treadmill");
        assertThat(RunLabelService.keyOf("Hill Repeats")).isEqualTo("hill repeats");
    }

    @Test
    void theOrderTheRunnerGaveIsTheOrderKept() {
        assertThat(RunLabelService.cleanTags(List.of("c", "a", "b"))).containsExactly("c", "a", "b");
        assertThat(RunLabelService.cleanTags(List.of())).isEmpty();
    }

    @Test
    void sixTagsAreAllowedAndSevenAreNot() {
        List<String> six = List.of("a", "b", "c", "d", "e", "f");
        assertThat(RunLabelService.cleanTags(six)).hasSize(RunLabelService.MAX_TAGS);
        assertThatThrownBy(() -> RunLabelService.cleanTags(List.of("a", "b", "c", "d", "e", "f", "g")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("6");
        // Seven spellings of six words are six tags.
        assertThat(RunLabelService.cleanTags(List.of("a", "b", "c", "d", "e", "f", "A"))).hasSize(6);
    }

    @Test
    void twentyFourCharactersAreAllowedAndTwentyFiveAreNot() {
        assertThat(RunLabelService.cleanTags(List.of("x".repeat(24)))).hasSize(1);
        assertThatThrownBy(() -> RunLabelService.cleanTags(List.of("x".repeat(25))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("24");
    }

    @Test
    void anEmojiIsOneCharacterNotTwo() {
        assertThat(RunLabelService.cleanTags(List.of("🏃".repeat(24)))).hasSize(1);
        assertThatThrownBy(() -> RunLabelService.cleanTags(List.of("🏃".repeat(25)))).isInstanceOf(IllegalArgumentException.class);
        assertThat(RunLabelService.cleanTags(List.of("跑".repeat(24)))).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "\t\n", "\u0000"})
    void aTagWithNothingInItIsRefused(String blank) {
        assertThatThrownBy(() -> RunLabelService.cleanTags(List.of("fine", blank)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("empty");
    }

    @Test
    void aTagThatIsNotTextIsRefused() {
        List<Object> mixed = new ArrayList<>(List.of("fine"));
        mixed.add(7);
        assertThatThrownBy(() -> RunLabelService.cleanTags(mixed)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("text");
        List<Object> withNull = new ArrayList<>();
        withNull.add(null);
        assertThatThrownBy(() -> RunLabelService.cleanTags(withNull)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theRunTypesAreRaceLongRunAndWorkoutAndNothingElse() {
        assertThat(RunTypes.ALL).containsExactly("RACE", "LONG_RUN", "WORKOUT");
        for (String type : RunTypes.ALL) {
            assertThat(RunTypes.isValid(type)).isTrue();
        }
        for (String not : new String[] {null, "", "race", "Race", "ULTRA", " RACE", "RACE "}) {
            assertThat(RunTypes.isValid(not)).as("'%s'", not).isFalse();
        }
    }
}
