package com.hermes.backend;

import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class GpxActivityFileParser extends AbstractXmlActivityFileParser {
    @Override
    public boolean supports(String fileExtension) {
        return "GPX".equalsIgnoreCase(fileExtension);
    }

    @Override
    public ParsedActivityData parse(String fileName, byte[] fileBytes) {
        Document document = parseDocument(fileBytes);
        List<Element> trackPoints = elementsByLocalName(document, "trkpt");
        if (trackPoints.isEmpty()) {
            throw new IllegalArgumentException("The GPX file does not contain any track points.");
        }

        List<ParsedTrackPoint> points = new ArrayList<>();
        LocalDateTime startTime = null;
        LocalDateTime endTime = null;

        for (Element trackPoint : trackPoints) {
            Double latitude = parseDouble(trackPoint.getAttribute("lat"));
            Double longitude = parseDouble(trackPoint.getAttribute("lon"));
            if (latitude == null || longitude == null) {
                continue;
            }

            points.add(new ParsedTrackPoint(latitude, longitude));

            LocalDateTime trackPointTime = parseDateTime(firstTextByLocalName(trackPoint, "time"));
            if (trackPointTime != null) {
                if (startTime == null) {
                    startTime = trackPointTime;
                }
                endTime = trackPointTime;
            }
        }

        if (points.isEmpty()) {
            throw new IllegalArgumentException("The GPX file does not contain any valid coordinates.");
        }

        String activityName = resolveName(document, fileName);
        Double distanceMeters = (double) estimateDistanceMeters(points);
        Long durationSeconds = durationSeconds(startTime, endTime);
        return new ParsedActivityData(
                activityName,
                ActivityType.UNKNOWN,
                startTime,
                distanceMeters,
                durationSeconds,
                points,
                null,
                null
        );
    }

    private String resolveName(Document document, String fileName) {
        List<Element> metadataElements = elementsByLocalName(document, "metadata");
        if (!metadataElements.isEmpty()) {
            String metadataName = firstTextByLocalName(metadataElements.get(0), "name");
            if (metadataName != null && !metadataName.isBlank()) {
                return metadataName;
            }
        }

        List<Element> trackElements = elementsByLocalName(document, "trk");
        if (!trackElements.isEmpty()) {
            String trackName = firstTextByLocalName(trackElements.get(0), "name");
            if (trackName != null && !trackName.isBlank()) {
                return trackName;
            }
        }

        return fileNameStem(fileName);
    }
}
