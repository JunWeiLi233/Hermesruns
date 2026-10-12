package com.hermes.backend.activity;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RunTextsTests {

    // --- the title ----------------------------------------------------------------------------------------------

    @Test
    void aTitleIsOneLineOfWordsWithSingleSpaces() {
        assertThat(RunTexts.cleanName("Sunday long run")).isEqualTo("Sunday long run");
        assertThat(RunTexts.cleanName("  Sunday   long\trun \n")).isEqualTo("Sunday long run");
        assertThat(RunTexts.cleanName("two\nlines\r\nhere")).isEqualTo("two lines here");
        assertThat(RunTexts.cleanName("no break　space")).as("a no-break or ideographic space is a space").isEqualTo("no break space");
    }

    @Test
    void anyLanguageAndEmojiAreFine() {
        assertThat(RunTexts.cleanName("晨跑 10 公里 🏃‍♀️")).isEqualTo("晨跑 10 公里 🏃‍♀️");
        assertThat(RunTexts.cleanName("Café – Güle güle")).isEqualTo("Café – Güle güle");
        assertThat(RunTexts.cleanName("=SUM(A1)")).as("formulas are made harmless by the export, not by the title").isEqualTo("=SUM(A1)");
    }

    @Test
    void aTitleCanBeUpToTheLimitAndNotOneMore() {
        String limit = "a".repeat(RunTexts.MAX_NAME_LENGTH);
        assertThat(RunTexts.cleanName(limit)).isEqualTo(limit);
        assertThatThrownBy(() -> RunTexts.cleanName(limit + "a")).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("120");
    }

    @Test
    void theLimitIsOnTheTitleAfterTheSpacesAreTidied() {
        String padded = "  " + "a".repeat(RunTexts.MAX_NAME_LENGTH) + "  \n";
        assertThat(RunTexts.cleanName(padded)).hasSize(RunTexts.MAX_NAME_LENGTH);
        assertThat(RunTexts.cleanName("a" + " ".repeat(500) + "b")).isEqualTo("a b");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "   ", "\n", "\t \r\n", " ", "　　"})
    void aTitleCannotBeEmpty(String blank) {
        assertThatThrownBy(() -> RunTexts.cleanName(blank)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("title");
    }

    @ParameterizedTest
    @ValueSource(strings = {"bell\u0007", "nul\u0000", "esc\u001b[31m", "next\u0085line", "del\u007f"})
    void aTitleWithControlCharactersIsRefused(String text) {
        assertThatThrownBy(() -> RunTexts.cleanName(text)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("control");
    }

    @Test
    void aTitleIsText() {
        for (Object notText : new Object[] {null, 42, 4.5, true, List.of("a"), new Object()}) {
            assertThatThrownBy(() -> RunTexts.cleanName(notText)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    // --- the notes ----------------------------------------------------------------------------------------------

    @Test
    void notesKeepTheirLinesAndLoseTheWhitespaceAroundThem() {
        assertThat(RunTexts.cleanNotes("Felt heavy.\n\nLegs were tired.")).isEqualTo("Felt heavy.\n\nLegs were tired.");
        assertThat(RunTexts.cleanNotes("\n  first\n  second  \n\n")).isEqualTo("first\n  second");
        assertThat(RunTexts.cleanNotes("a\tb")).as("a tab is allowed").isEqualTo("a\tb");
    }

    @Test
    void windowsAndOldMacLineEndingsBecomeNewlines() {
        assertThat(RunTexts.cleanNotes("a\r\nb\rc\nd")).isEqualTo("a\nb\nc\nd");
    }

    @Test
    void noNotesOrNotesOfNothingAreNoNotes() {
        assertThat(RunTexts.cleanNotes(null)).isNull();
        assertThat(RunTexts.cleanNotes("")).isNull();
        assertThat(RunTexts.cleanNotes("  \n\t \r\n ")).isNull();
    }

    @Test
    void notesCanBeUpToTheLimitAndNotOneMore() {
        String limit = "ab".repeat(RunTexts.MAX_NOTES_LENGTH / 2);
        assertThat(RunTexts.cleanNotes(limit)).hasSize(RunTexts.MAX_NOTES_LENGTH);
        assertThatThrownBy(() -> RunTexts.cleanNotes(limit + "c")).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("2000");
    }

    @Test
    void theLimitCountsTheCharactersTheBrowserCounts() {
        // An emoji is two characters (UTF-16 units) in Java and in a browser's value.length, so the counter and the server agree.
        String emoji = "🏃";
        assertThat(emoji.length()).isEqualTo(2);
        assertThat(RunTexts.cleanNotes(emoji.repeat(RunTexts.MAX_NOTES_LENGTH / 2))).isNotNull();
        assertThatThrownBy(() -> RunTexts.cleanNotes(emoji.repeat(RunTexts.MAX_NOTES_LENGTH / 2 + 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"bell\u0007", "nul\u0000", "esc\u001b", "next\u0085line", "del\u007f"})
    void notesWithControlCharactersAreRefused(String text) {
        assertThatThrownBy(() -> RunTexts.cleanNotes(text)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("control");
    }

    @Test
    void notesAreTextOrNothing() {
        for (Object notText : new Object[] {42, 4.5, true, List.of("a"), new Object()}) {
            assertThatThrownBy(() -> RunTexts.cleanNotes(notText)).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
