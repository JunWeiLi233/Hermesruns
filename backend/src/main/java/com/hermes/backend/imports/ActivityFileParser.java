package com.hermes.backend.imports;

public interface ActivityFileParser {
    boolean supports(String fileExtension);

    ParsedActivityData parse(String fileName, byte[] fileBytes);
}
