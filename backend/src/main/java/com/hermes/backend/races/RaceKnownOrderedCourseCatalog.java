package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import java.util.Optional;

final class RaceKnownOrderedCourseCatalog {
    private RaceKnownOrderedCourseCatalog() {
    }

    static boolean isUploadShortcutKnownCourseContext(String raceName, String city, String country) {
        return isAmsterdamCourseContext(raceName, city, country)
                || isHelsinkiCourseContext(raceName, city, country)
                || isIstanbulCourseContext(raceName, city, country)
                || isJakartaCourseContext(raceName, city, country)
                || isJerusalemCourseContext(raceName, city, country)
                || isLisbonCourseContext(raceName, city, country)
                || isLondonCourseContext(raceName, city, country)
                || isManchesterCourseContext(raceName, city, country)
                || isMarineCorpsCourseContext(raceName, city, country)
                || isMarrakechCourseContext(raceName, city, country)
                || isMexicoCityCourseContext(raceName, city, country)
                || isMilanCourseContext(raceName, city, country)
                || isMumbaiCourseContext(raceName, city, country)
                || isMunichCourseContext(raceName, city, country)
                || isNairobiCityCourseContext(raceName, city, country)
                || isStandardCharteredNairobiCourseContext(raceName, city, country)
                || isNiceCannesCourseContext(raceName, city, country)
                || isParisMarathonCourseContext(raceName, city, country)
                || isPortoCourseContext(raceName, city, country)
                || isPragueCourseContext(raceName, city, country)
                || isQingdaoCourseContext(raceName, city, country)
                || isQueenstownCourseContext(raceName, city, country)
                || isRomeCourseContext(raceName, city, country)
                || SupplementalMarathonKnownCourses.matches(raceName, city, country)
                || isKualaLumpurCourseContext(raceName, city, country)
                || isBusanCourseContext(raceName, city, country);
    }

    static KnownOrderedCourse knownOrderedCourseFor(String raceName, String city, String country) {
        if (isAmsterdamCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    AmsterdamMarathonOfficialCourse.routePoints(),
                    AmsterdamMarathonOfficialCourse.OFFICIAL_SOURCE,
                    "Known ordered Amsterdam Marathon route uses the verified organizer course geometry.",
                    12
            );
        }
        if (isChicagoCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    ChicagoMarathonKnownCourse.routePoints(),
                    ChicagoMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Chicago Marathon route replaced near-loop CV ordering.",
                    3
            );
        }
        if (isChongqingCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    ChongqingMarathonKnownCourse.routePoints(),
                    ChongqingMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Chongqing Marathon route replaced low-resolution CV extraction.",
                    1
            );
        }
        if (isCopenhagenCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    CopenhagenMarathonKnownCourse.routePoints(),
                    CopenhagenMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Copenhagen Marathon route replaced official interactive-map extraction.",
                    CopenhagenMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isDalianCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    DalianMarathonKnownCourse.routePoints(),
                    DalianMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Dalian Marathon route replaced stylized official-map extraction.",
                    DalianMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isDohaCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    DohaMarathonKnownCourse.routePoints(),
                    DohaMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Doha Marathon route replaced repeated-corridor official-map extraction.",
                    DohaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isDubaiCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    DubaiMarathonKnownCourse.routePoints(),
                    DubaiMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Dubai Marathon route replaced repeated Jumeirah Beach Road corridor extraction.",
                    DubaiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isHelsinkiCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    HelsinkiMarathonKnownCourse.routePoints(),
                    HelsinkiMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Helsinki Marathon route replaced official Google My Maps extraction.",
                    HelsinkiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isIstanbulCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    IstanbulMarathonKnownCourse.routePoints(),
                    IstanbulMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Istanbul Marathon route replaced official Google My Maps extraction.",
                    IstanbulMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isJakartaCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    JakartaMarathonKnownCourse.routePoints(),
                    JakartaMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Jakarta Marathon route replaced official Strava route embed extraction.",
                    JakartaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isJerusalemCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    JerusalemMarathonKnownCourse.routePoints(),
                    JerusalemMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Jerusalem Marathon route replaced official PDF bounds georeference extraction.",
                    JerusalemMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isLisbonCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    LisbonMarathonKnownCourse.routePoints(),
                    LisbonMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Lisbon Marathon route replaced synthetic placeholder geometry.",
                    LisbonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isLondonCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    LondonMarathonKnownCourse.routePoints(),
                    LondonMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered London Marathon route replaced official road-closure PDF extraction with checked GPX geometry.",
                    LondonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isManchesterCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    ManchesterMarathonKnownCourse.routePoints(),
                    ManchesterMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Manchester Marathon route replaced synthetic placeholder geometry with checked GPX geometry.",
                    ManchesterMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMarineCorpsCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MarineCorpsMarathonKnownCourse.routePoints(),
                    MarineCorpsMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Marine Corps Marathon route replaced partial official event-map extraction with checked course geometry.",
                    MarineCorpsMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMarrakechCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MarrakechMarathonKnownCourse.routePoints(),
                    MarrakechMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Marrakech Marathon route replaced synthetic placeholder geometry with official GPX geometry.",
                    MarrakechMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMexicoCityCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MexicoCityMarathonKnownCourse.routePoints(),
                    MexicoCityMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Mexico City Marathon route replaced synthetic placeholder geometry with official route-poster geometry.",
                    MexicoCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMilanCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MilanMarathonKnownCourse.routePoints(),
                    MilanMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Milan Marathon route replaced synthetic placeholder geometry with checked GPX geometry.",
                    MilanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMumbaiCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MumbaiMarathonKnownCourse.routePoints(),
                    MumbaiMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Mumbai Marathon route replaced synthetic placeholder geometry with official-map and checked GPX geometry.",
                    MumbaiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isMunichCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    MunichMarathonKnownCourse.routePoints(),
                    MunichMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Munich Marathon route replaced synthetic placeholder geometry with official-PDF and checked GPX geometry.",
                    MunichMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isNairobiCityCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    NairobiCityMarathonKnownCourse.routePoints(),
                    NairobiCityMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Nairobi City Marathon route replaced synthetic placeholder geometry with official GPX geometry.",
                    NairobiCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isStandardCharteredNairobiCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    StandardCharteredNairobiMarathonKnownCourse.routePoints(),
                    StandardCharteredNairobiMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Standard Chartered Nairobi Marathon route replaced synthetic placeholder geometry with official guide-map road geometry.",
                    StandardCharteredNairobiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isNiceCannesCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    NiceCannesMarathonKnownCourse.routePoints(),
                    NiceCannesMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Nice-Cannes Marathon route replaced synthetic placeholder geometry with official GPX geometry.",
                    NiceCannesMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isParisMarathonCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    ParisMarathonKnownCourse.routePoints(),
                    ParisMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Paris Marathon route replaced synthetic placeholder geometry with official-map and checked GPX geometry.",
                    ParisMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isPortoCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    PortoMarathonKnownCourse.routePoints(),
                    PortoMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Porto Marathon route replaced synthetic placeholder geometry with official-map and checked GPS trace geometry.",
                    PortoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isPragueCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    PragueMarathonKnownCourse.routePoints(),
                    PragueMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Prague Marathon route replaced synthetic placeholder geometry with official RunCzech Mapy geometry.",
                    PragueMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isQingdaoCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    QingdaoMarathonKnownCourse.routePoints(),
                    QingdaoMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Qingdao Marathon route replaced synthetic placeholder geometry with official 2026 road-sequence geometry.",
                    QingdaoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isQueenstownCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    QueenstownMarathonKnownCourse.routePoints(),
                    QueenstownMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Queenstown Marathon route replaced synthetic placeholder geometry with official road-trail course geometry.",
                    QueenstownMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isRomeCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    RomeMarathonKnownCourse.routePoints(),
                    RomeMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Rome Marathon route replaced synthetic placeholder geometry with official 2026 GPX course geometry.",
                    RomeMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isKualaLumpurCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    KualaLumpurMarathonKnownCourse.routePoints(),
                    KualaLumpurMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Kuala Lumpur Marathon route replaced stylized official-PDF extraction.",
                    KualaLumpurMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        if (isBusanCourseContext(raceName, city, country)) {
            return new KnownOrderedCourse(
                    BusanMarathonKnownCourse.routePoints(),
                    BusanMarathonKnownCourse.SOURCE_NOTE,
                    "Known ordered Busan Marathon route replaced official National Sports Festival PDF extraction.",
                    BusanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
            );
        }
        Optional<SupplementalMarathonKnownCourses.CourseDefinition> supplementalCourse =
                SupplementalMarathonKnownCourses.find(raceName, city, country);
        if (supplementalCourse.isPresent()) {
            SupplementalMarathonKnownCourses.CourseDefinition course = supplementalCourse.get();
            return new KnownOrderedCourse(
                    course.routePoints(),
                    course.sourceNote(),
                    course.description(),
                    course.maxSelfIntersections()
            );
        }
        return null;
    }

    static KnownCourseRouteVerdict assessKnownCourseRoute(List<RoutePoint> routePoints, String raceName, String city, String country, RaceCourseMapGeometryService geometryService) {
        if (isAmsterdamCourseContext(raceName, city, country)) {
            return assessAmsterdamCourseRoute(routePoints, geometryService);
        }
        if (!isBostonCourseContext(raceName, city, country)) {
            return new KnownCourseRouteVerdict(true, "no race-specific course geography gate");
        }
        if (routePoints == null || routePoints.size() < 2) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route has no usable point-to-point geometry");
        }
        OverlayBounds bounds = geometryService.boundsFromRoute(routePoints);
        if (bounds.west() > -71.45 || bounds.east() < -71.11 || (bounds.east() - bounds.west()) < 0.32) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route does not span the Hopkinton-to-Boston west-east corridor");
        }
        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        double firstToStart = geometryService.haversineKm(first.lat(), first.lng(), 42.2295, -71.5218);
        double firstToFinish = geometryService.haversineKm(first.lat(), first.lng(), 42.3499, -71.0784);
        double lastToStart = geometryService.haversineKm(last.lat(), last.lng(), 42.2295, -71.5218);
        double lastToFinish = geometryService.haversineKm(last.lat(), last.lng(), 42.3499, -71.0784);
        boolean endpointsMatch = (firstToStart <= 9.0 && lastToFinish <= 9.0)
                || (firstToFinish <= 9.0 && lastToStart <= 9.0);
        if (!endpointsMatch) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route endpoints do not land near Hopkinton start and Boylston/Copley finish");
        }
        boolean passesInteriorCourse = routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.2834, -71.3495) <= 9.0)
                && routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.2965, -71.2926) <= 9.0)
                && routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.3389, -71.2092) <= 11.0);
        if (!passesInteriorCourse) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route misses the Natick-Wellesley-Newton course corridor");
        }
        return new KnownCourseRouteVerdict(true, "Boston Marathon course geography accepted");
    }

    private static KnownCourseRouteVerdict assessAmsterdamCourseRoute(
            List<RoutePoint> routePoints,
            RaceCourseMapGeometryService geometryService) {
        if (routePoints == null || routePoints.size() < 2) {
            return new KnownCourseRouteVerdict(false, "Amsterdam Marathon route has no usable geometry");
        }
        OverlayBounds bounds = geometryService.boundsFromRoute(routePoints);
        if (bounds.south() > 52.307 || bounds.east() < 4.932) {
            return new KnownCourseRouteVerdict(
                    false,
                    "Amsterdam Marathon route misses the defining Amstel southbound and east-side return corridors");
        }

        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        double firstToStadium = geometryService.haversineKm(first.lat(), first.lng(), 52.3434439, 4.8540543);
        double lastToStadium = geometryService.haversineKm(last.lat(), last.lng(), 52.3434439, 4.8540543);
        if (firstToStadium > 2.0 || lastToStadium > 2.0) {
            return new KnownCourseRouteVerdict(
                    false,
                    "Amsterdam Marathon route does not start and finish at the Olympic Stadium");
        }

        boolean reachesOuderkerk = passesNear(routePoints, 52.2968417, 4.9042702, 2.2, geometryService);
        boolean reachesEastReturn = passesNear(routePoints, 52.3535915, 4.9389997, 2.0, geometryService);
        boolean reachesMuseum = passesNear(routePoints, 52.3598431, 4.8850395, 1.2, geometryService);
        boolean reachesVondelpark = passesNear(routePoints, 52.3571974, 4.8641190, 1.5, geometryService);
        if (!reachesOuderkerk || !reachesEastReturn || !reachesMuseum || !reachesVondelpark) {
            return new KnownCourseRouteVerdict(
                    false,
                    "Amsterdam Marathon route misses organizer checkpoints along the Amstel, Science Park, Rijksmuseum, or Vondelpark");
        }
        return new KnownCourseRouteVerdict(true, "Amsterdam Marathon organizer corridor accepted");
    }

    private static boolean passesNear(
            List<RoutePoint> routePoints,
            double latitude,
            double longitude,
            double radiusKm,
            RaceCourseMapGeometryService geometryService) {
        return routePoints.stream().anyMatch(point ->
                geometryService.haversineKm(point.lat(), point.lng(), latitude, longitude) <= radiusKm);
    }

    private static boolean isAmsterdamCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("amsterdam") && combined.contains("marathon");
    }

    private static boolean isBostonCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("boston") && combined.contains("marathon");
    }

    private static boolean isChicagoCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("chicago") && combined.contains("marathon");
    }

    private static boolean isChongqingCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("chongqing") || combined.contains("\u91cd\u5e86")) && combined.contains("marathon");
    }

    private static boolean isCopenhagenCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("copenhagen") && combined.contains("marathon");
    }

    private static boolean isDalianCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("dalian") && combined.contains("marathon");
    }

    private static boolean isDohaCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("doha") && combined.contains("marathon");
    }

    private static boolean isDubaiCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("dubai") && combined.contains("marathon");
    }

    private static boolean isHelsinkiCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("helsinki") && combined.contains("marathon");
    }

    private static boolean isIstanbulCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("istanbul") && combined.contains("marathon");
    }

    private static boolean isJakartaCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("jakarta") && combined.contains("marathon");
    }

    private static boolean isJerusalemCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("jerusalem") || combined.contains("yerushalayim"))
                && combined.contains("marathon");
    }

    private static boolean isLisbonCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("lisbon") || combined.contains("lisboa"))
                && combined.contains("marathon");
    }

    private static boolean isLondonCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("london") && combined.contains("marathon");
    }

    private static boolean isManchesterCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("manchester") && combined.contains("marathon");
    }

    private static boolean isMarineCorpsCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("marine corps") || combined.contains("mcm"))
                && combined.contains("marathon");
    }

    private static boolean isMarrakechCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("marrakech") || combined.contains("marrakesh"))
                && combined.contains("marathon");
    }

    private static boolean isMexicoCityCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("mexico city") || combined.contains("ciudad de mexico") || combined.contains("cdmx"))
                && (combined.contains("marathon") || combined.contains("maraton"));
    }

    private static boolean isMilanCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("milan") || combined.contains("milano"))
                && combined.contains("marathon");
    }

    private static boolean isMumbaiCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("mumbai") && combined.contains("marathon");
    }

    private static boolean isMunichCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("munich") || combined.contains("muenchen") || combined.contains("m\u00fcnchen"))
                && combined.contains("marathon");
    }

    private static boolean isNairobiCityCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("nairobi city") && combined.contains("marathon");
    }

    private static boolean isStandardCharteredNairobiCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("nairobi")
                && combined.contains("marathon")
                && !combined.contains("nairobi city");
    }

    private static boolean isNiceCannesCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("nice")
                && combined.contains("cannes")
                && combined.contains("marathon");
    }

    private static boolean isParisMarathonCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("paris")
                && (combined.contains("paris marathon")
                || combined.contains("marathon de paris")
                || combined.contains("marathon of paris")
                || combined.contains("schneider electric marathon"));
    }

    private static boolean isPortoCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("porto") || combined.contains("oporto"))
                && (combined.contains("marathon") || combined.contains("maratona"));
    }

    private static boolean isPragueCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("prague") || combined.contains("praha"))
                && (combined.contains("marathon") || combined.contains("maraton"));
    }

    private static boolean isQingdaoCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("qingdao") && combined.contains("marathon");
    }

    private static boolean isQueenstownCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("queenstown") && combined.contains("marathon");
    }

    private static boolean isRomeCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("rome") || combined.contains("roma"))
                && (combined.contains("marathon") || combined.contains("maratona"));
    }

    private static boolean isKualaLumpurCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("kuala lumpur") || combined.contains("klscm"))
                && combined.contains("marathon");
    }

    private static boolean isBusanCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return (combined.contains("busan") || combined.contains("\ubd80\uc0b0"))
                && combined.contains("marathon");
    }


    private static String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT); }

    static record KnownOrderedCourse(List<RoutePoint> routePoints, String sourceNote, String description, int maxSelfIntersections) {}
    static record KnownCourseRouteVerdict(boolean accepted, String reason) {}
}
