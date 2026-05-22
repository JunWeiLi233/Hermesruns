package com.hermes.backend;

import com.ibm.icu.text.Transliterator;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Builds a canonical fingerprint for brand + model so the same shoe under different scripts
 * (e.g. Chinese {@code 赤焰5} vs romanized {@code Chiyan 5}) maps to one key for duplicate detection.
 */
@Service
public class ShoeIdentityService {

    private static final Transliterator TO_LATIN_ASCII = Transliterator.getInstance("Any-Latin; Latin-ASCII");
    private static final int MAX_KEY_LEN = 240;

    /**
     * Lowercase Latin-ish fingerprint: transliterate CJK → Latin, strip to a-z0-9 only.
     */
    public String computeIdentityKey(String brand, String model) {
        String b = brand != null ? brand : "";
        String m = model != null ? model : "";
        String combined = (b + " " + m).trim();
        if (combined.isEmpty()) {
            return "na";
        }
        String nfkc = Normalizer.normalize(combined, Normalizer.Form.NFKC);
        String latin = TO_LATIN_ASCII.transliterate(nfkc);
        String folded = latin.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
        if (folded.isEmpty()) {
            return "na";
        }
        return folded.length() > MAX_KEY_LEN ? folded.substring(0, MAX_KEY_LEN) : folded;
    }

    public void applyIdentityKey(Shoe shoe) {
        shoe.setIdentityKey(computeIdentityKey(shoe.getBrand(), shoe.getModel()));
    }
}
