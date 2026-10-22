package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityTypeResolver;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

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
        boolean distanceRecorded = false, timeRecorded = false;
        for (Element lapElement : childElementsByLocalName(activityElement, "Lap")) {
            Double lapDistance = parseDouble(firstTextByLocalName(lapElement, "DistanceMeters"));
            Double lapTime = parseDouble(firstTextByLocalName(lapElement, "TotalTimeSeconds"));
            if (lapDistance != null) {
                distanceRecorded = true;
                totalDistanceMeters += lapDistance;
            }
            if (lapTime != null) {
                timeRecorded = true;
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
            if (cadence == null) {
                Double runCadence = firstPositiveDescendantDouble(trackPointElement, "RunCadence", "run_cadence");
                cadence = runCadence == null ? null : (int) Math.round(runCadence);
            }
            Double groundContactTimeMs = firstPositiveDescendantDouble(trackPointElement,
                    "GroundContactTime", "GroundContactTimeMs", "StanceTime", "stance_time", "ground_contact_time");
            Double verticalOscillationMm = firstPositiveDescendantDouble(trackPointElement,
                    "VerticalOscillation", "VerticalOscillationMm", "vertical_oscillation");

            points.add(new ParsedTrackPoint(
                    latitude,
                    longitude,
                    elapsedSeconds,
                    distanceMetersTrack,
                    elevationMeters,
                    heartRate,
                    cadence,
                    groundContactTimeMs,
                    verticalOscillationMm
            ));
        }

        if (points.isEmpty() && !explorerPolicy()) {
            throw new IllegalArgumentException("The TCX file does not contain any valid coordinates.");
        }

        Double distanceMeters = explorerPolicy() ? distanceRecorded ? totalDistanceMeters : points.isEmpty() ? null : (double) estimateDistanceMeters(points)
                : totalDistanceMeters > 0 ? totalDistanceMeters : (double) estimateDistanceMeters(points);
        Long durationSeconds = explorerPolicy() && timeRecorded ? Math.round(totalTimeSeconds) : totalTimeSeconds > 0 ? Math.round(totalTimeSeconds) : durationSeconds(startTime, endTime);
        return new ParsedActivityData(
                resolveName(sport, startTime, fileName),
                ActivityTypeResolver.fromSportLabels(sport),
                startTime,
                distanceMeters,
                durationSeconds,
                points,
                null,
                null,
                sourceLaps(activityElement, startTime)
        );
    }

    private List<com.hermes.backend.activity.analysis.SessionAnalysisSources.Lap> sourceLaps(
            Element activity, LocalDateTime activityStart) {
        var laps = new ArrayList<com.hermes.backend.activity.analysis.SessionAnalysisSources.Lap>();
        for (Element lap : childElementsByLocalName(activity, "Lap")) {
            // Intensity must belong directly to this Lap; nested workout templates do not classify it.
            String intensity = firstTextByLocalName(lap, "Intensity");
            String kind = "Active".equals(intensity) ? "work"
                    : "Resting".equals(intensity) ? "recovery" : "unknown";
            LocalDateTime start = parseDateTime(lap.getAttribute("StartTime"));
            LocalDateTime end = null;
            var timestamps = lap.getElementsByTagNameNS("*", "Time");
            for (int i = 0; i < timestamps.getLength(); i++) {
                LocalDateTime time = parseDateTime(timestamps.item(i).getTextContent());
                if (time != null && (end == null || time.isAfter(end))) end = time;
            }
            laps.add(new com.hermes.backend.activity.analysis.SessionAnalysisSources.Lap(
                    "lap-" + (laps.size() + 1), kind, elapsed(activityStart, start), elapsed(activityStart, end),
                    finiteNonnegative(parseDouble(firstTextByLocalName(lap, "TotalTimeSeconds"))),
                    finiteNonnegative(parseDouble(firstTextByLocalName(lap, "DistanceMeters"))), intensity));
        }
        return List.copyOf(laps);
    }

    private Integer elapsed(LocalDateTime base, LocalDateTime time) {
        if (base == null || time == null) return null;
        long seconds = java.time.Duration.between(base, time).getSeconds();
        return seconds >= 0 && seconds <= Integer.MAX_VALUE ? (int) seconds : null;
    }

    private Double finiteNonnegative(Double value) {
        return value != null && Double.isFinite(value) && value >= 0 ? value : null;
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

    private Double firstPositiveDescendantDouble(Element parent, String... localNames) {
        for (String localName : localNames) {
            var nodes = parent.getElementsByTagNameNS("*", localName);
            for (int index = 0; index < nodes.getLength(); index += 1) {
                if (nodes.item(index) instanceof Element element) {
                    Double value = parseDouble(element.getTextContent());
                    if (value != null && value > 0 && Double.isFinite(value)) {
                        return value;
                    }
                }
            }
        }
        return null;
    }
}
