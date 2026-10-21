package com.hermes.backend.imports;

import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

abstract class AbstractXmlActivityFileParser implements ActivityFileParser {
    private final ThreadLocal<Document> explorerDocument = new ThreadLocal<>();

    protected boolean explorerPolicy() { return explorerDocument.get() != null; }

    @Override
    public ParsedActivityData parseForExplorer(String fileName, byte[] fileBytes) {
        Document document = parseDocument(fileBytes);
        if (!List.of("gpx", "TrainingCenterDatabase").contains(document.getDocumentElement().getLocalName())) {
            throw new IllegalArgumentException("The file content does not match a supported workout format.");
        }
        if (elementsByLocalName(document, "Activity").size() > 1 || elementsByLocalName(document, "trk").size() > 1) {
            throw new IllegalArgumentException("Use one activity per file.");
        }
        // Require an explicit offset for every source timestamp. Legacy local timestamps are never reinterpreted.
        String offset = null;
        for (String name : List.of("time", "Time", "Id")) {
            for (Element element : elementsByLocalName(document, name)) {
                String text = element.getTextContent().trim();
                try { String found = OffsetDateTime.parse(text).getOffset().toString(); if (offset == null) offset = found; }
                catch (RuntimeException invalid) { throw new IllegalArgumentException("Source timestamps must include UTC or an explicit offset."); }
            }
        }
        explorerDocument.set(document);
        try {
            ParsedActivityData parsed = parse(fileName, fileBytes);
            List<Element> sourcePoints = elementsByLocalName(document, supports("GPX") ? "trkpt" : "Trackpoint");
            List<ParsedTrackPoint> points = new ArrayList<>();
            Node previousParent = null;
            int segment = 0, index = 0;
            for (Element element : sourcePoints) {
                Element position = supports("GPX") ? element : firstChildElementByLocalName(element, "Position");
                Double lat = position == null ? null : parseDouble(supports("GPX") ? element.getAttribute("lat") : firstTextByLocalName(position, "LatitudeDegrees"));
                Double lon = position == null ? null : parseDouble(supports("GPX") ? element.getAttribute("lon") : firstTextByLocalName(position, "LongitudeDegrees"));
                if (lat == null || lon == null) { segment++; continue; }
                if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 85.05112878 || Math.abs(lon) > 180) {
                    throw new IllegalArgumentException("Unsupported or invalid source coordinates.");
                }
                if (element.getParentNode() != previousParent) { segment++; previousParent = element.getParentNode(); }
                ParsedTrackPoint p = parsed.points().get(index++);
                points.add(new ParsedTrackPoint(p.latitude(), p.longitude(), p.elapsedSeconds(), p.distanceMeters(),
                        p.elevationMeters(), p.heartRate(), p.cadence(), p.groundContactTimeMs(), p.verticalOscillationMm(), segment));
            }
            String sport = supports("GPX") ? firstDocumentText(document, "type")
                    : elementsByLocalName(document, "Activity").get(0).getAttribute("Sport");
            String subtype = firstDocumentText(document, "workoutType");
            var metadata = new ParsedActivityData.SourceMetadata(sport, subtype,
                    sourceBoolean(document, "commute"), sourceBoolean(document, "trainer"),
                    firstDocumentText(document, "gear"), offset, parsed.durationSeconds());
            return new ParsedActivityData(parsed.name(), parsed.activityType(), parsed.startTime(), parsed.distanceMeters(),
                    parsed.durationSeconds(), points, parsed.averageHeartRate(), parsed.maxHeartRate(), parsed.sourceLaps(), metadata);
        } finally { explorerDocument.remove(); }
    }

    private String firstDocumentText(Document document, String name) {
        List<Element> matches = elementsByLocalName(document, name);
        return matches.isEmpty() ? null : matches.get(0).getTextContent().trim();
    }

    private Boolean sourceBoolean(Document document, String name) {
        String value = firstDocumentText(document, name);
        return "true".equalsIgnoreCase(value) || "1".equals(value) ? Boolean.TRUE
                : "false".equalsIgnoreCase(value) || "0".equals(value) ? Boolean.FALSE : null;
    }

    protected Document parseDocument(byte[] fileBytes) {
        if (explorerPolicy()) return explorerDocument.get();
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setExpandEntityReferences(false);

            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new ByteArrayInputStream(fileBytes));
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to parse XML workout file.", exception);
        }
    }

    protected List<Element> elementsByLocalName(Document document, String localName) {
        NodeList nodeList = document.getElementsByTagNameNS("*", localName);
        List<Element> elements = new ArrayList<>();
        for (int index = 0; index < nodeList.getLength(); index++) {
            Node node = nodeList.item(index);
            if (node instanceof Element element) {
                elements.add(element);
            }
        }
        return elements;
    }

    protected List<Element> childElementsByLocalName(Element parent, String localName) {
        List<Element> elements = new ArrayList<>();
        NodeList children = parent.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Node node = children.item(index);
            if (node instanceof Element element && localName.equals(element.getLocalName())) {
                elements.add(element);
            }
        }
        return elements;
    }

    protected Element firstChildElementByLocalName(Element parent, String localName) {
        List<Element> elements = childElementsByLocalName(parent, localName);
        return elements.isEmpty() ? null : elements.get(0);
    }

    protected String firstTextByLocalName(Element parent, String localName) {
        Element child = firstChildElementByLocalName(parent, localName);
        if (child == null) {
            return null;
        }

        String text = child.getTextContent();
        return text == null ? null : text.trim();
    }

    protected String fileNameStem(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "Imported Activity";
        }

        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex <= 0) {
            return fileName.trim();
        }

        return fileName.substring(0, dotIndex).trim();
    }

    protected LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            OffsetDateTime parsed = OffsetDateTime.parse(value.trim());
            return explorerPolicy() ? LocalDateTime.ofInstant(parsed.toInstant(), java.time.ZoneOffset.UTC) : parsed.toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(value.trim());
            } catch (Exception secondIgnored) {
                return null;
            }
        }
    }

    protected Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    protected long estimateDistanceMeters(List<ParsedTrackPoint> points) {
        if (points.size() < 2) {
            return 0L;
        }

        double total = 0;
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

    protected Long durationSeconds(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null || endTime == null) {
            return null;
        }

        long seconds = Duration.between(startTime, endTime).getSeconds();
        return Math.max(seconds, 0);
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
