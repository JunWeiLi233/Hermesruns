package com.hermes.backend.races;

import java.util.ArrayList;
import java.util.List;

/**
 * Official-course landmark corridors for races whose organizer publishes a
 * map/route description but does not provide a reusable GPX track.
 *
 * <p>These are deliberately turning-point corridors, not synthetic circles:
 * the bulk seed service routes each consecutive pair through pedestrian OSRM
 * and keeps the straight corridor as a deterministic fallback when the public
 * router is unavailable. The source URL and note are persisted with the map
 * asset so the runner-facing page never presents these routes as AI guesses.</p>
 */
final class MarathonOfficialLandmarkCourseCatalog {

    private MarathonOfficialLandmarkCourseCatalog() {
    }

    static Course find(String raceId) {
        if (raceId == null || raceId.isBlank()) return null;
        return switch (raceId) {
            case "big-sur-marathon" -> bigSur();
            case "honolulu-marathon" -> honolulu();
            case "barcelona-marathon" -> barcelona();
            case "bangkok-marathon" -> bangkok();
            case "comrades-marathon" -> comrades();
            case "buenos-aires-marathon" -> buenosAires();
            case "bergen-city-marathon" -> bergen();
            case "brussels-airport-marathon" -> brussels();
            case "rio-marathon" -> rio();
            case "beijing-marathon" -> beijing();
            case "hong-kong-marathon" -> hongKong();
            case "auckland-marathon" -> auckland();
            case "cape-town-marathon" -> capeTown();
            case "fukuoka-marathon" -> fukuoka();
            case "guangzhou-marathon" -> guangzhou();
            case "chengdu-marathon" -> chengdu();
            case "hangzhou-marathon" -> hangzhou();
            case "dublin-marathon" -> dublin();
            case "ho-chi-minh-city-marathon" -> hoChiMinh();
            case "amsterdam-marathon" -> amsterdam();
            default -> null;
        };
    }

    static boolean has(String raceId) {
        return find(raceId) != null;
    }

    static String labelAt(String raceId, int index) {
        Course course = find(raceId);
        if (course == null || index < 0 || index >= course.landmarks().size()) return null;
        return course.landmarks().get(index).label();
    }

    private static Course bigSur() {
        return course("big-sur-marathon", "https://www.bigsurmarathon.org/races/marathon/",
                "Official Big Sur route: point-to-point on California Highway 1 from Big Sur Station to Carmel/Rio Road, including Bixby Bridge and the coastal aid-station corridor.",
                point(36.2447, -121.7799, "Start - Big Sur Station"),
                point(36.2704, -121.8081, "Big Sur Village"),
                point(36.2850, -121.8431, "Andrew Molera State Park"),
                point(36.3121, -121.8950, "Point Sur"),
                point(36.3293, -121.8948, "Little Sur River"),
                point(36.3538, -121.9023, "Hurricane Point"),
                point(36.3717, -121.9026, "Bixby Bridge"),
                point(36.3940, -121.9106, "Grimes Ranch"),
                point(36.4261, -121.9160, "Garrapata"),
                point(36.4547, -121.9275, "Soberanes"),
                point(36.5000, -121.9390, "Yankee Point"),
                point(36.5166, -121.9433, "Point Lobos"),
                point(36.5383, -121.9084, "Finish - Rio Road, Carmel"));
    }

    private static Course honolulu() {
        return course("honolulu-marathon", "https://www.honolulumarathon.org/our-events/jal-honolulu-marathon",
                "Official Honolulu map corridor: Ala Moana start, downtown waterfront, Waikiki and Diamond Head, the Hawaii Kai out-and-back, then Kapiolani Park finish.",
                point(21.2944, -157.8465, "Start - Ala Moana Boulevard"),
                point(21.3069, -157.8618, "Downtown / Aloha Tower"),
                point(21.2990, -157.8507, "Ala Moana return"),
                point(21.2825, -157.8307, "Waikiki"),
                point(21.2610, -157.8065, "Diamond Head"),
                point(21.2733, -157.7839, "Kahala"),
                point(21.2945, -157.6985, "Hawaii Kai Towne Center turnaround"),
                point(21.2794, -157.7305, "Maunalua Bay"),
                point(21.2733, -157.7839, "Kahala return"),
                point(21.2610, -157.8065, "Diamond Head return"),
                point(21.2698, -157.8226, "Finish - Kapiolani Park"));
    }

    private static Course barcelona() {
        return course("barcelona-marathon", "https://www.zurichmaratobarcelona.es/en/course/",
                "Official Zurich Marató Barcelona central course: Passeig de Gracia start, the monumental city loop through Sagrada Familia, Glories, Forum, Port Olimpic and the old city, Arc de Triomf finish.",
                point(41.3917, 2.1649, "Start - Passeig de Gracia"),
                point(41.3809, 2.1228, "Camp Nou"),
                point(41.3755, 2.1477, "Dona i Ocell"),
                point(41.3757, 2.1499, "Gran Via"),
                point(41.4036, 2.1744, "Sagrada Familia"),
                point(41.4144, 2.1998, "Bac de Roda Bridge"),
                point(41.4036, 2.1870, "Glories"),
                point(41.4115, 2.2213, "Parc del Forum"),
                point(41.3869, 2.1966, "Port Olimpic / Hotel Arts"),
                point(41.3846, 2.1858, "Estacio de Franca"),
                point(41.3788, 2.1635, "Sant Antoni Market"),
                point(41.3758, 2.1776, "Columbus Monument"),
                point(41.3869, 2.1632, "University of Barcelona"),
                point(41.3910, 2.1809, "Finish - Arc de Triomf"));
    }

    private static Course bangkok() {
        return course("bangkok-marathon", "https://amazingthailandmarathon.com/wp-content/uploads/ATMBKK2026_MAP_COURSE_42K.pdf",
                "Official Amazing Thailand Marathon Bangkok map corridor: MBK start/finish, Victory Monument, Rama VIII Bridge, the old-city monuments, the western Borommaratchachonnani out-and-back and Sanam Luang.",
                point(13.7445, 100.5291, "Start - MBK Center"),
                point(13.7649, 100.5383, "Victory Monument"),
                point(13.7683, 100.5009, "Rama VIII Bridge"),
                point(13.7537, 100.5068, "Golden Mountain"),
                point(13.7565, 100.5018, "Democracy Monument"),
                point(13.7500, 100.4915, "Royal Grand Palace"),
                point(13.7795, 100.4248, "Borommaratchachonnani turnaround"),
                point(13.7540, 100.4920, "Sanam Luang"),
                point(13.7565, 100.5018, "Democracy Monument return"),
                point(13.7445, 100.5291, "Finish - MBK Center"));
    }

    private static Course comrades() {
        return course("comrades-marathon", "https://comrades.com/dynamic-route-map",
                "Official 2026 Comrades Up Run corridor from Durban to Pietermaritzburg: Pinetown, Winston Park, Drummond halfway, Cato Ridge, Umlaas Road, Mkondeni and Scottsville finish.",
                point(-29.8587, 31.0218, "Start - Durban"),
                point(-29.8210, 30.8580, "Pinetown Underpass"),
                point(-29.7840, 30.7740, "Winston Park"),
                point(-29.7890, 30.8230, "Kloof"),
                point(-29.7280, 30.6690, "Drummond - Halfway"),
                point(-29.7250, 30.6150, "Inchanga"),
                point(-29.7410, 30.5830, "Cato Ridge"),
                point(-29.7070, 30.5150, "Umlaas Road"),
                point(-29.6200, 30.5130, "Polly Shortts"),
                point(-29.6250, 30.3730, "Mkondeni"),
                point(-29.6150, 30.3750, "Finish - Scottsville, Pietermaritzburg"));
    }

    private static Course buenosAires() {
        return course("buenos-aires-marathon", "https://www.maratondebuenosaires.com/",
                "Official Buenos Aires 42K corridor from Figueroa Alcorta through Ciudad Universitaria, Recoleta, the Obelisco, Casa Rosada, La Boca and Puerto Madero.",
                point(-34.5683, -58.4160, "Start - Figueroa Alcorta"),
                point(-34.5417, -58.4444, "Ciudad Universitaria"),
                point(-34.5453, -58.4498, "River Plate"),
                point(-34.5875, -58.3933, "Recoleta"),
                point(-34.6037, -58.3816, "Obelisco"),
                point(-34.6081, -58.3709, "Casa Rosada"),
                point(-34.6356, -58.3647, "La Boca / Bombonera"),
                point(-34.6110, -58.3524, "Puerto Madero"),
                point(-34.5900, -58.3720, "Costanera return"),
                point(-34.5683, -58.4160, "Finish - Figueroa Alcorta"));
    }

    private static Course bergen() {
        return course("bergen-city-marathon", "https://www.bergencitymarathon.no/en/distances-and-course-map/sport-1-marathon/",
                "Official Bergen City Marathon course: the certified half-marathon circuit is run twice, starting and finishing at Bryggen via Sandviken, Fjellveien, Svartediket, Store Lungegårdsvann and Nordnesparken.",
                point(60.3973, 5.3245, "Start - Bryggen"),
                point(60.4108, 5.3270, "Sandviken Hospital"),
                point(60.4104, 5.3380, "Fjellveien"),
                point(60.4050, 5.3500, "Skansemyren"),
                point(60.3920, 5.3600, "Svartediket"),
                point(60.3775, 5.3530, "Store Lungegårdsvann"),
                point(60.3820, 5.3370, "AdO Arena"),
                point(60.3860, 5.3170, "Nygårdsparken"),
                point(60.3970, 5.3110, "Nordnesparken"),
                point(60.3973, 5.3245, "Bryggen halfway"),
                point(60.4108, 5.3270, "Sandviken second lap"),
                point(60.4104, 5.3380, "Fjellveien second lap"),
                point(60.3920, 5.3600, "Svartediket second lap"),
                point(60.3775, 5.3530, "Store Lungegårdsvann second lap"),
                point(60.3970, 5.3110, "Nordnesparken second lap"),
                point(60.3973, 5.3245, "Finish - Bryggen"));
    }

    private static Course brussels() {
        return course("brussels-airport-marathon", "https://pressroom.brusselsairport.be/en-brussels-airport-marathon-2025",
                "Official Brussels Airport Marathon corridor: Place De Brouckere start, Basilica of Koekelberg, Laeken/Atomium, Tervuren and the Brussels inner-city finish at Place des Palais.",
                point(50.8512, 4.3529, "Start - Place De Brouckere"),
                point(50.8673, 4.3178, "Basilica of Koekelberg"),
                point(50.8949, 4.3415, "Atomium"),
                point(50.8956, 4.3344, "King Baudouin Stadium"),
                point(50.8589, 4.3852, "Josaphat Park"),
                point(50.8419, 4.3905, "Cinquantenaire Park"),
                point(50.8297, 4.4325, "Woluwe Park"),
                point(50.8237, 4.5142, "Tervuren"),
                point(50.8130, 4.5140, "Kapucijnenbos"),
                point(50.8040, 4.3790, "Bois de la Cambre"),
                point(50.8425, 4.3593, "Finish - Place des Palais"));
    }

    private static Course rio() {
        return course("rio-marathon", "https://www.maratonadorio.com.br/en/corrida/42k-2026",
                "Official Maratona do Rio 42K corridor: Praia da Reserva start in Recreio, the west-zone waterfront, Niemeyer/Ipanema/Copacabana and Botafogo waterfront to Aterro do Flamengo finish.",
                point(-23.0105, -43.4540, "Start - Praia da Reserva"),
                point(-23.0080, -43.4310, "Recreio waterfront"),
                point(-23.0050, -43.3920, "Barra da Tijuca"),
                point(-23.0000, -43.3650, "Sao Conrado"),
                point(-22.9870, -43.2470, "Avenida Niemeyer"),
                point(-22.9860, -43.2070, "Leblon"),
                point(-22.9710, -43.1880, "Ipanema"),
                point(-22.9650, -43.1790, "Copacabana"),
                point(-22.9520, -43.1730, "Botafogo"),
                point(-22.9100, -43.1730, "Flamengo waterfront"),
                point(-22.9068, -43.1729, "Finish - Aterro do Flamengo"));
    }

    private static Course beijing() {
        return course("beijing-marathon", "https://en.beijing-marathon.com/",
                "Official Bank of China Beijing Marathon corridor: Tiananmen start, west along Chang'an Avenue through CCTV and Haidian, north to Olympic Park and the National Stadium-area finish.",
                point(39.9042, 116.3975, "Start - Tiananmen Square"),
                point(39.9073, 116.3568, "Chang'an Avenue / Xidan"),
                point(39.9185, 116.3003, "CCTV Tower"),
                point(39.9432, 116.3254, "National Library"),
                point(39.9837, 116.3163, "Zhongguancun"),
                point(40.0169, 116.3835, "National Speed Skating Oval"),
                point(39.9929, 116.3965, "National Stadium / Bird's Nest"),
                point(40.0066, 116.3957, "Olympic Park"),
                point(40.0036, 116.3917, "Finish - Central Landscape Avenue"));
    }

    private static Course hongKong() {
        return course("hong-kong-marathon", "https://www.hkmarathon.com/zh-hant/course-maps",
                "Official Standard Chartered Hong Kong Marathon corridor: Tsim Sha Tsui start, West Kowloon and the Tsing Ma/Ma Wan out-and-back, Western Harbour Crossing, Central/Wan Chai and Victoria Park finish.",
                point(22.2995, 114.1722, "Start - Nathan Road, Tsim Sha Tsui"),
                point(22.3050, 114.1570, "West Kowloon"),
                point(22.3480, 114.1270, "Lai King"),
                point(22.3380, 114.0810, "Tsing Ma Bridge"),
                point(22.3400, 114.0590, "Ma Wan turnaround"),
                point(22.3380, 114.0810, "Tsing Ma Bridge return"),
                point(22.3660, 114.0950, "Ting Kau turnaround"),
                point(22.3380, 114.0810, "Tsing Ma second return"),
                point(22.3050, 114.1570, "West Kowloon return"),
                point(22.2870, 114.1500, "Western Harbour Crossing"),
                point(22.2810, 114.1580, "Central"),
                point(22.2780, 114.1730, "Wan Chai"),
                point(22.2820, 114.1880, "Finish - Victoria Park"));
    }

    private static Course auckland() {
        return course("auckland-marathon", "https://aucklandmarathon.co.nz/race-info/full-marathon/",
                "Official Auckland Marathon corridor: King Edward Parade Devonport start, Takapuna/Northern Busway, Harbour Bridge, Westhaven/Viaduct, Tamaki Drive to St Heliers and the Victoria Park finish.",
                point(-36.8318, 174.7983, "Start - King Edward Parade, Devonport"),
                point(-36.7876, 174.7720, "Takapuna"),
                point(-36.7862, 174.7522, "Smales Farm / Northern Busway"),
                point(-36.8172, 174.7452, "Auckland Harbour Bridge"),
                point(-36.8460, 174.7410, "Westhaven Marina"),
                point(-36.8440, 174.7550, "Viaduct Harbour"),
                point(-36.8491, 174.8307, "Mission Bay"),
                point(-36.8496, 174.8586, "St Heliers turnaround"),
                point(-36.8491, 174.8307, "Mission Bay return"),
                point(-36.8440, 174.7550, "Viaduct return"),
                point(-36.8478, 174.7540, "Finish - Victoria Park"));
    }

    private static Course capeTown() {
        return course("cape-town-marathon", "https://capetownmarathon.com/marathon/",
                "Official Sanlam Cape Town Marathon corridor: Stadium/Beach Road start, Sea Point Atlantic seaboard, Salt River/Woodstock, Rondebosch/Newlands and the Green Point finish.",
                point(-33.9055, 18.4080, "Start - Green Point Stadium"),
                point(-33.9186, 18.3890, "Sea Point Beach Road"),
                point(-33.9055, 18.4080, "Green Point return"),
                point(-33.9274, 18.4620, "Salt River / Liesbeek Parkway"),
                point(-33.9308, 18.4475, "Woodstock"),
                point(-33.9590, 18.4850, "Rondebosch Common"),
                point(-33.9720, 18.4675, "Newlands"),
                point(-33.9540, 18.4250, "Company's Garden corridor"),
                point(-33.9200, 18.4140, "V&A Waterfront"),
                point(-33.9046, 18.4103, "Finish - Green Point"));
    }

    private static Course fukuoka() {
        return course("fukuoka-marathon", "https://www.f-marathon.jp/en/course.php",
                "Official Fukuoka Marathon one-way course: Tenjin start, Seaside Momochi/Fukuoka Tower, Ikinomatsubara and Nagatare coast, Kyushu University Ito, Imazu/Kitazaki and Futamigaura, Itoshima finish.",
                point(33.5902, 130.4017, "Start - Tenjin"),
                point(33.5931, 130.3514, "Seaside Momochi / Fukuoka Tower"),
                point(33.5754, 130.3090, "Ikinomatsubara"),
                point(33.5719, 130.2750, "Nagatare Coast"),
                point(33.5969, 130.2180, "Kyushu University Ito Campus"),
                point(33.5950, 130.2500, "Imazu Sports Park"),
                point(33.6040, 130.1880, "Kitazaki"),
                point(33.5900, 130.1770, "Nishinoura"),
                point(33.5680, 130.1740, "Futamigaura"),
                point(33.5570, 130.1660, "Finish - Itoshima"));
    }

    private static Course guangzhou() {
        return course("guangzhou-marathon", "https://www.eguangzhou.gov.cn/gzwhatson/content/post_39242.html",
                "Official Guangzhou Marathon city corridor: Tianhe Sports Center start, Pearl River crossings and both banks through Tianhe, Haizhu, Pazhou/Canton Fair and Canton Tower, Haixinsha finish.",
                point(23.1380, 113.2650, "Start - Tianhe Sports Center"),
                point(23.1280, 113.2800, "Tianhe Road"),
                point(23.1190, 113.3250, "Haixin Bridge"),
                point(23.1060, 113.3240, "Canton Tower"),
                point(23.1030, 113.3630, "Pazhou / Canton Fair Complex"),
                point(23.0900, 113.3500, "Haizhu riverside"),
                point(23.1120, 113.3200, "Pearl River north bank"),
                point(23.1150, 113.3220, "Finish - Haixinsha"));
    }

    private static Course chengdu() {
        return course("chengdu-marathon", "https://www.chengdu-marathon.com/",
                "Official Chengdu Marathon corridor: Jinsha Heritage Museum start, Tianfu Square, Sichuan University/Wangjiang, Tianfu Avenue south corridor and Century City exhibition-centre finish.",
                point(30.6826, 104.0110, "Start - Jinsha Site Museum"),
                point(30.6720, 104.0350, "Qingyang District"),
                point(30.6570, 104.0658, "Tianfu Square"),
                point(30.6350, 104.0870, "Sichuan University Museum"),
                point(30.6100, 104.0860, "Wangjiang Campus"),
                point(30.5750, 104.0700, "Tianfu Avenue"),
                point(30.5450, 104.0665, "Tianfu Avenue south turnaround"),
                point(30.5574, 104.0668, "Finish - Century City Convention Center"));
    }

    private static Course hangzhou() {
        return course("hangzhou-marathon", "https://www.ehangzhou.gov.cn/2024-09/02/c_290710.htm",
                "Official Hangzhou Marathon corridor: Huanglong Sports Center start, West Lake and central Hangzhou, Qiantang River/Qianjiang New City and Olympic Sports Center Stadium finish.",
                point(30.2670, 120.1450, "Start - Huanglong Sports Center"),
                point(30.2590, 120.1580, "West Lake / Hubin"),
                point(30.2740, 120.1710, "Wulin Square"),
                point(30.2450, 120.1890, "Qianjiang New City"),
                point(30.2210, 120.1930, "Qiantang River north bank"),
                point(30.2040, 120.1760, "Binjiang riverside"),
                point(30.2080, 120.1750, "Finish - Olympic Sports Center Stadium"));
    }

    private static Course dublin() {
        return course("dublin-marathon", "https://irishlifedublinmarathon.ie/maps/",
                "Official Irish Life Dublin Marathon corridor: Leeson Street Lower start, the south-city avenues and Phoenix Park loop via Chesterfield Avenue, Castleknock Road, Wellington Road and the Phoenix Monument before the city finish.",
                point(53.3338, -6.2550, "Start - Leeson Street Lower"),
                point(53.3290, -6.2280, "Ballsbridge"),
                point(53.3370, -6.2590, "St Stephen's Green / city centre"),
                point(53.3550, -6.3290, "Phoenix Park entrance"),
                point(53.3630, -6.3290, "Chesterfield Avenue"),
                point(53.3710, -6.3360, "Castleknock Road"),
                point(53.3560, -6.3470, "Phoenix Monument"),
                point(53.3480, -6.3110, "Wellington Road / Phoenix Park"),
                point(53.3360, -6.2760, "Kilmainham"),
                point(53.3338, -6.2550, "Finish - central Dublin"));
    }

    private static Course hoChiMinh() {
        return course("ho-chi-minh-city-marathon", "https://marathonhcmc.com/en/ban-do-duong-chay-chinh-thuc-trinh-lang/",
                "Official Techcombank Ho Chi Minh City Marathon corridor: Le Duan/Nguyen Binh Khiem start, District 1 and Vo Van Kiet, Ba Son Bridge, Thu Thiem peninsula, Landmark 81 and Bach Dang finish.",
                point(10.7870, 106.7060, "Start - Le Duan / Nguyen Binh Khiem"),
                point(10.7790, 106.7030, "Nguyen Hue Walking Street"),
                point(10.7680, 106.6970, "Ton Duc Thang"),
                point(10.7540, 106.6920, "Vo Van Kiet"),
                point(10.7350, 106.6900, "Vo Van Kiet turnaround"),
                point(10.7730, 106.7260, "Ba Son Bridge"),
                point(10.7600, 106.7480, "Thu Thiem peninsula"),
                point(10.7900, 106.7480, "Empire City"),
                point(10.8010, 106.7220, "Landmark 81"),
                point(10.7870, 106.7060, "Finish - Bach Dang Wharf"));
    }

    private static Course amsterdam() {
        return course("amsterdam-marathon", "https://www.tcsamsterdammarathon.nl/parcours-highlights",
                "Official TCS Amsterdam Marathon 2026 corridor from the Olympic Stadium through Vondelpark, Rijksmuseum, Zuidas, the Amstel out-and-back at Ouderkerk, Amstel Business Park, Science Park, Zeeburgerdijk and Wibautstraat before returning through Vondelpark to the stadium.",
                point(52.3434439, 4.8540543, "Start - Olympic Stadium"),
                point(52.3476435, 4.8628866, "Marathonweg"),
                point(52.3560000, 4.8570000, "Vondelpark outbound"),
                point(52.3595000, 4.8795000, "Museumplein"),
                point(52.3598431, 4.8850395, "Rijksmuseum outbound"),
                point(52.3491448, 4.8839413, "Stadionweg"),
                point(52.3373746, 4.8769860, "Beethovenstraat / Zuidas"),
                point(52.3351478, 4.8575365, "De Boelelaan west"),
                point(52.3347000, 4.8940000, "De Boelelaan east"),
                point(52.3416064, 4.8914727, "Europaplein"),
                point(52.3406738, 4.8967587, "President Kennedylaan"),
                point(52.3384994, 4.9054316, "Martin Luther Kingpark"),
                point(52.3200000, 4.9010000, "Amsteldijk southbound"),
                point(52.3050000, 4.8960000, "Amstel south bank"),
                point(52.2968417, 4.9042702, "Ouderkerk turnaround"),
                point(52.3090000, 4.9130000, "Amstel northbound"),
                point(52.3260000, 4.9160000, "Amstel Business Park south"),
                point(52.3346416, 4.9133527, "Joan Muyskenweg"),
                point(52.3294483, 4.9305189, "Van der Madeweg"),
                point(52.3485072, 4.9410783, "Kruislaan / Science Park"),
                point(52.3535915, 4.9389997, "Galileiplantsoen"),
                point(52.3565706, 4.9380376, "Archimedesweg"),
                point(52.3661618, 4.9341741, "Zeeburgerdijk"),
                point(52.3660000, 4.9130000, "Mauritskade east"),
                point(52.3595944, 4.9072891, "Mauritskade / Wibautstraat"),
                point(52.3588894, 4.9047645, "Torontobrug"),
                point(52.3598431, 4.8850395, "Rijksmuseum return"),
                point(52.3595000, 4.8795000, "Museumplein return"),
                point(52.3560000, 4.8570000, "Vondelpark return"),
                point(52.3434439, 4.8540543, "Finish - Olympic Stadium"));
    }

    private static Course course(String raceId, String sourceUrl, String sourceNote, Landmark... landmarks) {
        List<Landmark> copy = new ArrayList<>(List.of(landmarks));
        return new Course(raceId, sourceUrl, sourceNote, List.copyOf(copy));
    }

    private static Landmark point(double lat, double lng, String label) {
        return new Landmark(lat, lng, label);
    }

    record Course(String raceId, String sourceUrl, String sourceNote, List<Landmark> landmarks) {
        List<double[]> waypoints() {
            List<double[]> points = new ArrayList<>(landmarks.size());
            for (Landmark landmark : landmarks) {
                points.add(new double[]{landmark.lat(), landmark.lng()});
            }
            return points;
        }

        int waypointCount() {
            return landmarks.size();
        }
    }

    record Landmark(double lat, double lng, String label) {
    }
}
