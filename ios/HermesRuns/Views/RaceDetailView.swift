import MapKit
import SwiftUI

struct RaceDetailView: View {
    @ObservedObject var session: SessionStore
    let race: HermesRace

    @State private var courseMap: HermesRaceCourseMap?
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Race intelligence")
                Text(race.name?.isEmpty == false ? race.name! : "Target race")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(race.location?.isEmpty == false ? race.location! : "Location not set")
                    .font(HermesTheme.body)
                    .foregroundStyle(HermesTheme.mutedInk)

                HermesCard {
                    HStack(spacing: 0) {
                        HermesMetric(value: countdown, label: "countdown")
                        HermesMetric(value: HermesFormatters.distance(race.distanceKm), label: "distance")
                        HermesMetric(value: goalTime, label: "goal")
                    }
                }

                HermesSectionLabel(text: "Course map")
                if isLoading {
                    ProgressView("Loading verified course data…")
                        .tint(HermesTheme.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 50)
                } else if let courseMap {
                    courseMapContent(courseMap)
                } else {
                    HermesCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Image(systemName: "map")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(HermesTheme.coral)
                            Text("No course data loaded yet")
                                .font(HermesTheme.title)
                            Text("Hermes will show a route only when the backend returns verified course geometry.")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk)
                            Button("Try again") { Task { await loadCourseMap() } }
                                .buttonStyle(HermesPrimaryButtonStyle())
                        }
                    }
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Race detail")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadCourseMap() }
    }

    @ViewBuilder
    private func courseMapContent(_ map: HermesRaceCourseMap) -> some View {
        let points = (map.routePoints ?? []).filter { CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)) }
        if map.routeAvailable == true && points.count > 1 {
            HermesCard {
                VStack(alignment: .leading, spacing: 12) {
                    HermesRaceMapView(points: points)
                        .frame(height: 280)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    HStack {
                        Label(map.officialRouteVerified == true ? "Official route" : "Verified route", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(HermesTheme.mintInk)
                        Spacer()
                        if let confidence = map.confidence { Text("\(confidence)% confidence") }
                    }
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    if let summary = map.summary, !summary.isEmpty {
                        Text(summary)
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        } else {
            HermesCard {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: map.cityLevelReference == true ? "mappin.and.ellipse" : "map.slash")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(HermesTheme.coral)
                    Text(map.cityLevelReference == true ? "City-level reference only" : "No verified route geometry")
                        .font(HermesTheme.title)
                    Text(map.summary?.isEmpty == false ? map.summary! : "Hermes did not return a distance-accurate route for this race.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }

        if let samples = map.elevationSamples, !samples.isEmpty {
            HermesCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Elevation profile")
                            .font(HermesTheme.title)
                        Spacer()
                        if let totalClimb = map.totalClimbMeters {
                            Text("+\(totalClimb) m")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk)
                        }
                    }
                    HermesElevationStrip(samples: samples)
                        .frame(height: 86)
                }
            }
        }
    }

    private func loadCourseMap() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = ""
        do {
            courseMap = try await session.fetchRaceCourseMap(race: race)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private var countdown: String {
        guard let date = HermesDate.parse(race.eventDate) else { return "—" }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
        return days < 0 ? "Past" : "D-\(days)"
    }

    private var goalTime: String {
        guard let seconds = race.goalTimeSeconds, seconds > 0 else { return "—" }
        return HermesFormatters.duration(Double(seconds))
    }
}

private struct HermesRaceMapView: UIViewRepresentable {
    let points: [HermesRaceRoutePoint]

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.showsCompass = false
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.removeOverlays(mapView.overlays)
        let coordinates = points.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
        guard coordinates.count > 1 else { return }
        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
        mapView.addOverlay(polyline)
        mapView.setVisibleMapRect(polyline.boundingMapRect, edgePadding: UIEdgeInsets(top: 28, left: 24, bottom: 28, right: 24), animated: false)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else { return MKOverlayRenderer(overlay: overlay) }
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor(HermesTheme.coral)
            renderer.lineWidth = 4
            return renderer
        }
    }
}

private struct HermesElevationStrip: View {
    let samples: [Int]

    var body: some View {
        GeometryReader { proxy in
            let minValue = samples.min() ?? 0
            let maxValue = max(samples.max() ?? 0, minValue + 1)
            Path { path in
                for (index, sample) in samples.enumerated() {
                    let x = samples.count == 1 ? 0 : proxy.size.width * CGFloat(index) / CGFloat(samples.count - 1)
                    let normalized = CGFloat(sample - minValue) / CGFloat(maxValue - minValue)
                    let y = proxy.size.height - normalized * proxy.size.height
                    if index == 0 { path.move(to: CGPoint(x: x, y: y)) } else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(HermesTheme.coral, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
        }
        .accessibilityLabel("Race elevation profile")
    }
}

struct RaceDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { RaceDetailView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard), race: HermesPreviewFixtures.dashboard.races[0]) }
    }
}
