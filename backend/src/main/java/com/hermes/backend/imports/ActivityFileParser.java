package com.hermes.backend.imports;

public interface ActivityFileParser {
    boolean supports(String fileExtension);

    ParsedActivityData parse(String fileName, byte[] fileBytes);

    /** Explorer's explicit lossless policy never changes legacy parser semantics. */
    default ParsedActivityData parseForExplorer(String fileName, byte[] fileBytes) {
        return parse(fileName, fileBytes);
    }
}
