package com.hermes.backend;

import com.garmin.fit.ActivityMesg;
import com.garmin.fit.ActivityMesgListener;
import com.garmin.fit.DateTime;
import com.garmin.fit.Decode;
import com.garmin.fit.LapMesg;
import com.garmin.fit.LapMesgListener;
import com.garmin.fit.MesgBroadcaster;
import com.garmin.fit.RecordMesg;
import com.garmin.fit.RecordMesgListener;
import com.garmin.fit.SessionMesg;
import com.garmin.fit.SessionMesgListener;
import com.garmin.fit.Sport;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class FitActivityFileParser implements ActivityFileParser {
    private static final double SEMICIRCLES_TO_DEGREES = 180d / 2147483648d;

    @Override
    public boolean supports(String fileExtension) {
        return "FIT".equalsIgnoreCase(fileExtension);
    }

    @Override
    public ParsedActivityData parse(String fileName, byte[] fileBytes) {
        validateFitIntegrity(fileBytes);

        FitActivityAccumulator accumulator = new FitActivityAccumulator();
        try {
            MesgBroadcaster broadcaster = new MesgBroadcaster();
            broadcaster.addListener((SessionMesgListener) accumulator::onSession);
            broadcaster.addListener((LapMesgListener) accumulator::onLap);
            broadcaster.addListener((ActivityMesgListener) accumulator::onActivity);
            broadcaster.addListener((RecordMesgListener) accumulator::onRecord);
            broadcaster.run(new ByteArrayInputStream(fileBytes));
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("The FIT file is invalid or corrupted.", exception);
        }

        return accumulator.toParsedActivityData(fileName);
    }

    private void validateFitIntegrity(byte[] fileBytes) {
        try {
            Decode decode = new Decode();
            if (!decode.checkFileIntegrity(new ByteArrayInputStream(fileBytes))) {
                throw new IllegalArgumentException("The FIT file is invalid or corrupted.");
            }
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("The FIT file is invalid or corrupted.", exception);
        }
    }

    private final class FitActivityAccumulator {
        private final List<ParsedTrackPoint> points = new ArrayList<>();
        private LocalDateTime sessionStartTime;
        private LocalDateTime lapStartTime;
        private LocalDateTime activityTimestamp;
        private LocalDateTime firstRecordTime;
        private LocalDateTime lastRecordTime;
        private Double sessionDistanceMeters;
        private Double lapDistanceMeters;
        private Double lastRecordDistanceMeters;
        private Long sessionDurationSeconds;
        private Long lapDurationSeconds;
        private Long activityDurationSeconds;
        private String sportProfileName;
        private String sportName;
        private Short sessionAvgHeartRate;
        private Short sessionMaxHeartRate;
        private long heartRateSum;
        private int heartRateCount;
        private short recordMaxHeartRate;

        private void onSession(SessionMesg mesg) {
            sessionStartTime = firstNonNull(sessionStartTime, toLocalDateTime(mesg.getStartTime()));
            sessionDistanceMeters = firstPositive(sessionDistanceMeters, toPositiveDouble(mesg.getTotalDistance()));
            sessionDurationSeconds = firstPositive(sessionDurationSeconds, toPositiveSeconds(mesg.getTotalTimerTime()));
            sportProfileName = firstNonBlank(sportProfileName, mesg.getSportProfileName());
            sportName = firstNonBlank(sportName, humanizeSport(mesg.getSport()));
            if (sessionAvgHeartRate == null && mesg.getAvgHeartRate() != null) {
                sessionAvgHeartRate = mesg.getAvgHeartRate();
            }
            if (sessionMaxHeartRate == null && mesg.getMaxHeartRate() != null) {
                sessionMaxHeartRate = mesg.getMaxHeartRate();
            }
        }

        private void onLap(LapMesg mesg) {
            lapStartTime = firstNonNull(lapStartTime, toLocalDateTime(mesg.getStartTime()));
            lapDistanceMeters = firstPositive(lapDistanceMeters, toPositiveDouble(mesg.getTotalDistance()));
            lapDurationSeconds = firstPositive(lapDurationSeconds, toPositiveSeconds(mesg.getTotalTimerTime()));
            sportName = firstNonBlank(sportName, humanizeSport(mesg.getSport()));
        }

        private void onActivity(ActivityMesg mesg) {
            activityTimestamp = firstNonNull(activityTimestamp, toLocalDateTime(mesg.getTimestamp()));
            activityDurationSeconds = firstPositive(activityDurationSeconds, toPositiveSeconds(mesg.getTotalTimerTime()));
        }

        private void onRecord(RecordMesg mesg) {
            LocalDateTime recordTime = toLocalDateTime(mesg.getTimestamp());
            if (recordTime != null) {
                firstRecordTime = firstNonNull(firstRecordTime, recordTime);
                lastRecordTime = recordTime;
            }

            lastRecordDistanceMeters = firstPositive(
                    toPositiveDouble(mesg.getDistance()),
                    lastRecordDistanceMeters
            );

            Short hr = mesg.getHeartRate();
            if (hr != null && hr > 0) {
                heartRateSum += hr;
                heartRateCount++;
                if (hr > recordMaxHeartRate) {
                    recordMaxHeartRate = hr;
                }
            }

            Integer latitude = mesg.getPositionLat();
            Integer longitude = mesg.getPositionLong();
            if (latitude == null || longitude == null) {
                return;
            }

            Integer elapsedSeconds = null;
            if (recordTime != null) {
                LocalDateTime base = firstNonNull(sessionStartTime, lapStartTime, firstRecordTime);
                if (base != null) {
                    long sec = Duration.between(base, recordTime).getSeconds();
                    if (sec >= 0 && sec <= Integer.MAX_VALUE) {
                        elapsedSeconds = (int) sec;
                    }
                }
            }

            Double distanceMeters = toPositiveDouble(mesg.getDistance());
            Double elevationMeters = toNullableDouble(mesg.getAltitude());
            Integer heartRate = hr != null && hr > 0 ? hr.intValue() : null;
            Short cadenceRaw = mesg.getCadence();
            Integer cadence = (cadenceRaw != null && cadenceRaw > 0) ? cadenceRaw.intValue() * 2 : null;

            points.add(new ParsedTrackPoint(
                    semicirclesToDegrees(latitude),
                    semicirclesToDegrees(longitude),
                    elapsedSeconds,
                    distanceMeters,
                    elevationMeters,
                    heartRate,
                    cadence
            ));
        }

        private ParsedActivityData toParsedActivityData(String fileName) {
            if (points.isEmpty()) {
                throw new IllegalArgumentException(
                        "The FIT file does not contain any GPS coordinates, so a heatmap route cannot be created."
                );
            }

            LocalDateTime startTime = firstNonNull(sessionStartTime, lapStartTime, firstRecordTime, activityTimestamp);
            Double distanceMeters = firstPositive(
                    sessionDistanceMeters,
                    lapDistanceMeters,
                    lastRecordDistanceMeters,
                    (double) estimateDistanceMeters(points)
            );
            Long durationSeconds = firstPositive(
                    sessionDurationSeconds,
                    lapDurationSeconds,
                    activityDurationSeconds,
                    durationSeconds(startTime, lastRecordTime)
            );

            Double avgHr = sessionAvgHeartRate != null ? (double) sessionAvgHeartRate
                    : (heartRateCount > 0 ? (double) heartRateSum / heartRateCount : null);
            Double maxHr = sessionMaxHeartRate != null ? (double) sessionMaxHeartRate
                    : (recordMaxHeartRate > 0 ? (double) recordMaxHeartRate : null);

            return new ParsedActivityData(
                    resolveName(fileName, startTime),
                    ActivityTypeResolver.fromSportLabels(sportProfileName, sportName),
                    startTime,
                    distanceMeters,
                    durationSeconds,
                    points,
                    avgHr,
                    maxHr
            );
        }

        private String resolveName(String fileName, LocalDateTime startTime) {
            String preferredName = firstNonBlank(sportProfileName, sportName);
            if (preferredName == null) {
                return fileNameStem(fileName);
            }

            if (startTime == null) {
                return preferredName;
            }

            return preferredName + " " + startTime.toLocalDate();
        }
    }

    private LocalDateTime toLocalDateTime(DateTime timestamp) {
        if (timestamp == null) {
            return null;
        }

        return LocalDateTime.ofInstant(timestamp.getInstant(), ZoneOffset.UTC);
    }

    private Double toPositiveDouble(Float value) {
        if (value == null || value <= 0f) {
            return null;
        }

        return value.doubleValue();
    }

    private Double toNullableDouble(Float value) {
        if (value == null) {
            return null;
        }
        return value.doubleValue();
    }

    private Long toPositiveSeconds(Float value) {
        if (value == null || value <= 0f) {
            return null;
        }

        return (long) Math.round(value);
    }

    @SafeVarargs
    private <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    @SafeVarargs
    private final <T extends Number> T firstPositive(T... values) {
        for (T value : values) {
            if (value != null && value.doubleValue() > 0d) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String firstValue, String secondValue) {
        if (firstValue != null && !firstValue.isBlank()) {
            return firstValue.trim();
        }

        if (secondValue != null && !secondValue.isBlank()) {
            return secondValue.trim();
        }

        return null;
    }

    private String humanizeSport(Sport sport) {
        if (sport == null || sport == Sport.INVALID) {
            return null;
        }

        String rawValue = sport.name().toLowerCase(Locale.ROOT).replace('_', ' ');
        String[] parts = rawValue.split(" ");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }

            if (builder.length() > 0) {
                builder.append(' ');
            }
            builder.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                builder.append(part.substring(1));
            }
        }
        return builder.toString();
    }

    private double semicirclesToDegrees(int value) {
        return value * SEMICIRCLES_TO_DEGREES;
    }

    private String fileNameStem(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "Imported Activity";
        }

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) {
            return fileName.trim();
        }

        return fileName.substring(0, dotIndex).trim();
    }

    private long estimateDistanceMeters(List<ParsedTrackPoint> points) {
        if (points.size() < 2) {
            return 0L;
        }

        double total = 0d;
        for (int index = 1; index < points.size(); index++) {
            ParsedTrackPoint previous = points.get(index - 1);
            ParsedTrackPoint current = points.get(index);
            total += haversineMeters(
                    previous.latitude(),
                    previous.longitude(),
                    current.latitude(),
                    current.longitude()
            );
        }

        return Math.round(total);
    }

    private Long durationSeconds(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            return null;
        }

        long seconds = Duration.between(startTime, endTime).getSeconds();
        return Math.max(seconds, 0L);
    }

    private double haversineMeters(double startLat, double startLon, double endLat, double endLon) {
        final double earthRadius = 6_371_000d;
        double latitudeDelta = Math.toRadians(endLat - startLat);
        double longitudeDelta = Math.toRadians(endLon - startLon);
        double startLatRadians = Math.toRadians(startLat);
        double endLatRadians = Math.toRadians(endLat);

        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
                + Math.cos(startLatRadians) * Math.cos(endLatRadians)
                * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }
}
