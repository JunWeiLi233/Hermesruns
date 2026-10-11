package com.hermes.backend.activity;

/**
 * What a runner may write on one of their runs, in their own words: the title and the notes. The rules only keep out what would
 * break a page or a file (nothing but control characters and length); they never judge the words.
 *
 * <p>Lengths are counted in Java characters (UTF-16 units), the same unit a browser's {@code value.length} counts, so the
 * counter the edit drawer shows and the limit the server applies are the same number. An emoji counts as two.</p>
 */
final class RunTexts {

    static final int MAX_NAME_LENGTH = 120;
    static final int MAX_NOTES_LENGTH = 2000;

    private RunTexts() {
    }

    /**
     * A title: one line. Whitespace of any kind, inside or around the words, becomes single spaces; it may not be empty.
     *
     * @throws IllegalArgumentException with a plain reason when the title is refused
     */
    static String cleanName(Object raw) {
        if (!(raw instanceof String text)) {
            throw new IllegalArgumentException("A title is some words.");
        }
        StringBuilder line = new StringBuilder(text.length());
        boolean pendingSpace = false;
        for (int index = 0; index < text.length(); index++) {
            char c = text.charAt(index);
            if (Character.isWhitespace(c) || Character.isSpaceChar(c)) {
                pendingSpace = line.length() > 0;
                continue;
            }
            if (Character.isISOControl(c)) {
                throw new IllegalArgumentException("A title cannot contain control characters.");
            }
            if (pendingSpace) {
                line.append(' ');
                pendingSpace = false;
            }
            line.append(c);
        }
        if (line.length() == 0) {
            throw new IllegalArgumentException("A run needs a title.");
        }
        if (line.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("A title can be up to " + MAX_NAME_LENGTH + " characters.");
        }
        return line.toString();
    }

    /**
     * Notes: any number of lines. Line endings become {@code \n}, the whitespace around the text is dropped, and nothing at all
     * (or only whitespace) means no notes, which comes back as null.
     *
     * @throws IllegalArgumentException with a plain reason when the notes are refused
     */
    static String cleanNotes(Object raw) {
        if (raw == null) {
            return null;
        }
        if (!(raw instanceof String text)) {
            throw new IllegalArgumentException("Notes are some words, or null for none.");
        }
        String lines = text.replace("\r\n", "\n").replace('\r', '\n');
        for (int index = 0; index < lines.length(); index++) {
            char c = lines.charAt(index);
            if (Character.isISOControl(c) && c != '\n' && c != '\t') {
                throw new IllegalArgumentException("Notes cannot contain control characters.");
            }
        }
        String clean = lines.strip();
        if (clean.isEmpty()) {
            return null;
        }
        if (clean.length() > MAX_NOTES_LENGTH) {
            throw new IllegalArgumentException("Notes can be up to " + MAX_NOTES_LENGTH + " characters.");
        }
        return clean;
    }
}
