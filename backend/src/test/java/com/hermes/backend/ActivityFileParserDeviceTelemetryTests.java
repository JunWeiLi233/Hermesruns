package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ActivityFileParserDeviceTelemetryTests {

    @Test
    void tcxParserReadsRunningDynamicsExtensions() {
        String tcx = """
                <?xml version="1.0" encoding="UTF-8"?>
                <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
                    xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                  <Activities>
                    <Activity Sport="Running">
                      <Id>2026-06-13T10:00:00Z</Id>
                      <Lap StartTime="2026-06-13T10:00:00Z">
                        <TotalTimeSeconds>1</TotalTimeSeconds>
                        <DistanceMeters>4</DistanceMeters>
                        <Track>
                          <Trackpoint>
                            <Time>2026-06-13T10:00:00Z</Time>
                            <Position>
                              <LatitudeDegrees>40.7000</LatitudeDegrees>
                              <LongitudeDegrees>-73.9000</LongitudeDegrees>
                            </Position>
                            <AltitudeMeters>8.0</AltitudeMeters>
                            <DistanceMeters>0</DistanceMeters>
                            <HeartRateBpm><Value>142</Value></HeartRateBpm>
                            <Extensions>
                              <ns3:TPX>
                                <ns3:RunCadence>86</ns3:RunCadence>
                                <ns3:GroundContactTime>241.5</ns3:GroundContactTime>
                                <ns3:VerticalOscillation>84.0</ns3:VerticalOscillation>
                              </ns3:TPX>
                            </Extensions>
                          </Trackpoint>
                          <Trackpoint>
                            <Time>2026-06-13T10:00:01Z</Time>
                            <Position>
                              <LatitudeDegrees>40.7001</LatitudeDegrees>
                              <LongitudeDegrees>-73.9001</LongitudeDegrees>
                            </Position>
                            <AltitudeMeters>8.1</AltitudeMeters>
                            <DistanceMeters>4</DistanceMeters>
                          </Trackpoint>
                        </Track>
                      </Lap>
                    </Activity>
                  </Activities>
                </TrainingCenterDatabase>
                """;

        ParsedActivityData parsed = new TcxActivityFileParser().parse("run.tcx", tcx.getBytes(StandardCharsets.UTF_8));

        assertEquals(2, parsed.points().size());
        assertEquals(241.5, parsed.points().get(0).groundContactTimeMs());
        assertEquals(84.0, parsed.points().get(0).verticalOscillationMm());
    }

    @Test
    void gpxParserReadsRunningDynamicsExtensions() {
        String gpx = """
                <?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" creator="Hermes" xmlns="http://www.topografix.com/GPX/1/1"
                    xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
                  <trk>
                    <name>Device telemetry run</name>
                    <trkseg>
                      <trkpt lat="40.7000" lon="-73.9000">
                        <ele>8.0</ele>
                        <time>2026-06-13T10:00:00Z</time>
                        <extensions>
                          <gpxtpx:TrackPointExtension>
                            <gpxtpx:hr>142</gpxtpx:hr>
                            <gpxtpx:cad>86</gpxtpx:cad>
                            <gpxtpx:StanceTime>239.0</gpxtpx:StanceTime>
                            <gpxtpx:VerticalOscillationMm>81.0</gpxtpx:VerticalOscillationMm>
                          </gpxtpx:TrackPointExtension>
                        </extensions>
                      </trkpt>
                      <trkpt lat="40.7001" lon="-73.9001">
                        <ele>8.2</ele>
                        <time>2026-06-13T10:00:01Z</time>
                      </trkpt>
                    </trkseg>
                  </trk>
                </gpx>
                """;

        ParsedActivityData parsed = new GpxActivityFileParser().parse("run.gpx", gpx.getBytes(StandardCharsets.UTF_8));

        assertEquals(2, parsed.points().size());
        assertEquals(239.0, parsed.points().get(0).groundContactTimeMs());
        assertEquals(81.0, parsed.points().get(0).verticalOscillationMm());
    }
}
