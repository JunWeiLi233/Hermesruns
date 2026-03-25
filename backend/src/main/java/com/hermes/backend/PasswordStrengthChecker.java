package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Enforces password rules for email/password sign-up.
 */
public final class PasswordStrengthChecker {

    public static final int MIN_LENGTH = 10;
    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "password", "password123", "12345678", "123456789", "qwerty", "welcome",
            "admin", "letmein", "monkey", "dragon", "sunshine", "princess", "football",
            "iloveyou", "trustno1", "abc123", "master", "login", "passw0rd", "hermes");

    private PasswordStrengthChecker() {
    }

    public record Result(boolean ok, List<String> failedRuleIds) {
        public static Result pass() {
            return new Result(true, List.of());
        }

        public static Result fail(List<String> ids) {
            return new Result(false, List.copyOf(ids));
        }
    }

    /**
     * Rule ids: MIN_LENGTH, UPPERCASE, LOWERCASE, DIGIT, SPECIAL, NOT_COMMON
     */
    public static Result check(String password) {
        List<String> failed = new ArrayList<>();
        if (password == null) {
            return Result.fail(List.of("MIN_LENGTH"));
        }

        if (password.length() < MIN_LENGTH) {
            failed.add("MIN_LENGTH");
        }

        boolean upper = false;
        boolean lower = false;
        boolean digit = false;
        boolean special = false;
        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (Character.isUpperCase(c)) {
                upper = true;
            } else if (Character.isLowerCase(c)) {
                lower = true;
            } else if (Character.isDigit(c)) {
                digit = true;
            } else if (isSpecial(c)) {
                special = true;
            }
        }

        if (!upper) {
            failed.add("UPPERCASE");
        }
        if (!lower) {
            failed.add("LOWERCASE");
        }
        if (!digit) {
            failed.add("DIGIT");
        }
        if (!special) {
            failed.add("SPECIAL");
        }

        String lowerPwd = password.toLowerCase(Locale.ROOT);
        if (COMMON_PASSWORDS.contains(lowerPwd)) {
            failed.add("NOT_COMMON");
        }

        return failed.isEmpty() ? Result.pass() : Result.fail(failed);
    }

    private static boolean isSpecial(char c) {
        return "!@#$%^&*()_+-=[]{}|;:,.<>?/~`\"'\\".indexOf(c) >= 0;
    }

    public static boolean looksLikeEmail(String email) {
        if (email == null || email.isBlank()) {
            return false;
        }
        String e = email.trim();
        int at = e.indexOf('@');
        if (at < 1 || at == e.length() - 1) {
            return false;
        }
        String domain = e.substring(at + 1);
        return domain.contains(".") && e.length() <= 254 && !e.contains(" ") && !e.contains("..");
    }
}
