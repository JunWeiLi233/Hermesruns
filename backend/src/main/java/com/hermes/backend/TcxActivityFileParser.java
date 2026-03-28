package com.hermes.backend;

import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class TcxActivityFileParser extends AbstractXmlActivityFileParser {
    @Override
    public boolean supports(String fileExtension) {
        return "TCX".equalsIgnoreCase(fileExtension);
    }

    @Override
    public ParsedActivityData parse(String fileName, byte[] fileBytes) {
        Document document = parseDocument(fileBytes);
        List<Element> activityElements = elementsByLocalName(document, "Activity");
        if (activityElements.isEmpty()) {
            throw new IllegalArgumentException("The TCX file does not contain any activity data.");
        }

        Element activityElement = activityElements.get(0);
        LocalDateTime startTime = parseDateTime(firstTextByLocalName(activityElement, "Id"));
        String sport = activityElement.getAttribute("Sport");

        double totalDistanceMeters = 0d;
        double totalTimeSeconds = 0d;
        for (Element lapElement : childElementsByLocalName(activityElement, "Lap")) {
            Double lapDistance = parseDouble(firstTextByLocalName(lapElement, "DistanceMeters"));
            Double lapTime = parseDouble(firstTextByLocalName(lapElement, "TotalTimeSeconds"));
            if (lapDistance != null) {
                totalDistanceMeters += lapDistance;
            }
            if (lapTime != null) {
                totalTimeSeconds += lapTime;
            }
        }

        List<ParsedTrackPoint> points = new ArrayList<>();
        LocalDateTime endTime = null;

        List<Element> trackPointElements = elementsByLocalName(document, "Trackpoint");
        for (Element trackPointElement : trackPointElements) {
            Element positionElement = firstChildElementByLocalName(trackPointElement, "Position");
            if (positionElement == null) {
                continue;
            }

            Double latitude = parseDouble(firstTextByLocalName(positionElement, "LatitudeDegrees"));
            Double longitude = parseDouble(firstTextByLocalName(positionElement, "LongitudeDegrees"));
            if (latitude == null || longitude == null) {
                continue;
            }

            LocalDateTime trackPointTime = parseDateTime(firstTextByLocalName(trackPointElement, "Time"));
            if (startTime == null && trackPointTime != null) {
                startTime = trackPointTime;
            }
            if (trackPointTime != null) {
                endTime = trackPointTime;
            }

            Integer elapsedSeconds = null;
            if (startTime != null && trackPointTime != null) {
                long sec = java.time.Duration.between(startTime, trackPointTime).getSeconds();
                if (sec >= 0 && sec <= Integer.MAX_VALUE) {
                    elapsedSeconds = (int) sec;
                }
            }
            Double distanceMetersTrack = parseDouble(firstTextByLocalName(trackPointElement, "DistanceMeters"));
            Double elevationMeters = parseDouble(firstTextByLocalName(trackPointElement, "AltitudeMeters"));
            Element hrElem = firstChildElementByLocalName(trackPointElement, "HeartRateBpm");
            Integer heartRate = hrElem != null ? parseInt(firstTextByLocalName(hrElem, "Value")) : null;
            Integer cadence = parseInt(firstTextByLocalName(trackPointElement, "Cadence"));

            points.add(new ParsedTrackPoint(
                    latitude,
                    longitude,
                    elapsedSeconds,
                    distanceMetersTrack,
                    elevationMeters,
                    heartRate,
                    cadence
            ));
        }

        if (points.isEmpty()) {
            throw new IllegalArgumentException("The TCX file does not contain any valid coordinates.");
        }

        Double distanceMeters = totalDistanceMeters > 0 ? totalDistanceMeters : (double) estimateDistanceMeters(points);
        Long durationSeconds = totalTimeSeconds > 0 ? Math.round(totalTimeSeconds) : durationSeconds(startTime, endTime);
        return new ParsedActivityData(
                resolveName(sport, startTime, fileName),
                ActivityTypeResolver.fromSportLabels(sport),
                startTime,
                distanceMeters,
                durationSeconds,
                points,
                null,
                null
        );
    }

    private String resolveName(String sport, LocalDateTime startTime, String fileName) {
        String sportName = (sport == null || sport.isBlank()) ? "Workout" : sport.trim();
        if (startTime != null) {
            return sportName + " " + startTime.toLocalDate();
        }

        return fileNameStem(fileName);
    }

    private Integer parseInt(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            int n = (int) Math.round(Double.parseDouble(value.trim()));
            return n > 0 ? n : null;
        } catch (Exception ignored) {
            return null;
        }
    }
}
