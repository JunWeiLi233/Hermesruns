package com.hermes.backend;

public interface ActivityFileParser {
    boolean supports(String fileExtension);

    ParsedActivityData parse(String fileName, byte[] fileBytes);
}
