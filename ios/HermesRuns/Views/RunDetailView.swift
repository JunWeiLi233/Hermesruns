import Foundation
import MapKit
import SwiftUI

struct RunDetailView: View {
    @ObservedObject var session: SessionStore
    let run: HermesRun

    @State private var analytics: HermesRunAnalytics?
    @State private var telemetry: HermesRunTelemetry?
    @State private var routePoints: [HermesRoutePoint] = []
    @State private var routeLoading = false
    @State private var insightsLoading = false
    @State private var insightsError = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Run detail")
                Text(run.name?.isEmpty == false ? run.name! : "Run")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(HermesFormatters.date(run.displayDate))
                    .font(HermesTheme.body)
                    .foregroundStyle(HermesTheme.mutedInk)

                HermesCard(fill: HermesTheme.ink) {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("RUN LEDGER")
                            .font(HermesTheme.section)
                            .tracking(1)
                            .foregroundStyle(HermesTheme.coralSoft)
                        HStack(spacing: 0) {
                            HermesMetric(value: HermesFormatters.distance(run.resolvedDistanceKm), label: "distance", valueColor: .white, labelColor: .white.opacity(0.62))
                            HermesMetric(value: HermesFormatters.duration(run.resolvedDurationSeconds), label: "time", valueColor: .white, labelColor: .white.opacity(0.62))
                            HermesMetric(value: HermesFormatters.pace(distanceKm: run.resolvedDistanceKm, seconds: run.resolvedDurationSeconds), label: "pace", valueColor: .white, labelColor: .white.opacity(0.62))
                        }
                    }
                }

                HermesSectionLabel(text: "Run signals")
                HermesCard {
                    VStack(spacing: 0) {
                        DetailRow(label: "Average heart rate", value: formatted(run.averageHeartRate, suffix: " bpm"))
                        Divider().overlay(HermesTheme.line)
                        DetailRow(label: "Elevation gain", value: formatted(run.totalElevationGain, suffix: " m"))
                        Divider().overlay(HermesTheme.line)
                        DetailRow(label: "Average cadence", value: formatted(run.averageCadence, suffix: " spm"))
                        Divider().overlay(HermesTheme.line)
                        DetailRow(label: "Source", value: run.provider?.capitalized ?? "Manual")
                    }
                }

                if let shoeName = run.shoeName, !shoeName.isEmpty {
                    HermesCard(fill: HermesTheme.coralSoft) {
                        HStack(spacing: 12) {
                            Image(systemName: "shoeprints.fill")
                                .foregroundStyle(HermesTheme.coral)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Shoe used")
                                    .font(HermesTheme.caption)
                                    .foregroundStyle(HermesTheme.ink.opacity(0.62))
                                Text(shoeName)
                                    .font(.system(size: 17, weight: .bold, design: .rounded))
                                    .foregroundStyle(HermesTheme.ink)
                            }
                        }
                    }
                }

                if routeLoading {
                    ProgressView("Loading route…")
                        .tint(HermesTheme.coral)
                        .font(HermesTheme.caption)
                } else if routePoints.count >= 2 {
                    HermesRouteMapView(points: Array(routePoints.prefix(5000)))
                        .frame(height: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .accessibilityLabel("Run route map")
                } else {
                    Text("No route coordinates were captured for this run.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                }

                if insightsLoading {
                    ProgressView("Loading post-run review…")
                        .tint(HermesTheme.coral)
                        .font(HermesTheme.caption)
                }
                if let analytics {
                    postRunReview(analytics)
                }
                if let telemetry {
                    telemetryReview(telemetry)
                }
                if !insightsError.isEmpty {
                    Text(insightsError)
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("Elevation recalibration and run deletion remain available in the Hermes web detail route.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Run")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadInsights() }
        .task { await loadRoute() }
    }

    @ViewBuilder
    private func postRunReview(_ analytics: HermesRunAnalytics) -> some View {
        HermesSectionLabel(text: "Post-run review")
        if let debrief = analytics.debrief {
            HermesCard(fill: HermesTheme.mint) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("COACH DEBRIEF")
                            .font(HermesTheme.section)
                            .tracking(1)
                            .foregroundStyle(HermesTheme.mintInk)
                        Spacer()
                        if let readiness = debrief.readinessScore {
                            Text("Readiness \(readiness)")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mintInk)
                        }
                    }
                    if let interpretation = debrief.interpretation, !interpretation.isEmpty {
                        Text(interpretation)
                            .font(HermesTheme.body)
                            .foregroundStyle(HermesTheme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let guidance = debrief.nextDayGuidance, !guidance.isEmpty {
                        Text(guidance)
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }

        HermesCard {
            HStack(spacing: 0) {
                HermesMetric(value: analytics.averageCadence.map { String(format: "%.0f spm", $0) } ?? "—", label: "cadence")
                HermesMetric(value: analytics.averageStrideLengthMeters.map { String(format: "%.2f m", $0) } ?? "—", label: "stride")
                HermesMetric(value: analytics.cardiacDrift.map { String(format: "%.1f%%", $0.driftPercent ?? 0) } ?? "—", label: "cardiac drift")
            }
        }

        if let laps = analytics.laps, !laps.isEmpty {
            HermesCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("LAP BREAKDOWN")
                        .font(HermesTheme.section)
                        .tracking(1)
                        .foregroundStyle(HermesTheme.coral)
                    ForEach(Array(laps.prefix(6).enumerated()), id: \.offset) { _, lap in
                        HStack {
                            Text("Lap \(lap.lapIndex ?? 0)")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.mutedInk)
                            Spacer()
                            Text(HermesFormatters.distance(lap.distanceKm))
                            Text(lap.pace ?? "—")
                            if let hr = lap.averageHeartRate { Text("\(hr) bpm") }
                        }
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.ink)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func telemetryReview(_ telemetry: HermesRunTelemetry) -> some View {
        if let effect = telemetry.trainingEffect, effect.available == true {
            HermesCard {
                VStack(alignment: .leading, spacing: 12) {
                    HermesSectionLabel(text: "Training effect")
                    HStack(spacing: 0) {
                        HermesMetric(value: effect.aerobic.map { String(format: "%.1f", $0) } ?? "—", label: "aerobic")
                        HermesMetric(value: effect.anaerobic.map { String(format: "%.1f", $0) } ?? "—", label: "anaerobic")
                        HermesMetric(value: "\(telemetry.sampleCount ?? 0)", label: "samples")
                    }
                    if let basis = effect.source ?? effect.basis {
                        Text("Source: \(basis.replacingOccurrences(of: "_", with: " "))")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                }
            }
        }
    }

    private func loadInsights() async {
        guard let id = run.id else {
            insightsError = "This run has no server identifier for post-run analysis."
            return
        }
        insightsLoading = true
        insightsError = ""
        do {
            analytics = try await session.fetchRunAnalytics(id: id)
        } catch {
            insightsError = error.localizedDescription
        }
        do {
            telemetry = try await session.fetchRunTelemetry(id: id)
        } catch {
            if analytics == nil { insightsError = error.localizedDescription }
        }
        insightsLoading = false
    }

    private func loadRoute() async {
        guard let id = run.id else { return }
        routeLoading = true
        defer { routeLoading = false }
        do {
            routePoints = try await session.fetchRunRoute(id: id)
        } catch {
            routePoints = []
        }
    }

    private func formatted(_ value: Double?, suffix: String) -> String {
        guard let value else { return "—" }
        return String(format: "%.0f%@", value, suffix)
    }
}

private struct HermesRouteMapView: UIViewRepresentable {
    let points: [HermesRoutePoint]

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.showsCompass = false
        mapView.pointOfInterestFilter = .excludingAll
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.removeOverlays(mapView.overlays)
        let coordinates = points.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        guard coordinates.count >= 2 else { return }
        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)
        mapView.addOverlay(polyline)
        mapView.setVisibleMapRect(
            polyline.boundingMapRect,
            edgePadding: UIEdgeInsets(top: 28, left: 28, bottom: 28, right: 28),
            animated: false
        )
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let polyline = overlay as? MKPolyline else { return MKOverlayRenderer(overlay: overlay) }
            let renderer = MKPolylineRenderer(polyline: polyline)
            renderer.strokeColor = UIColor(HermesTheme.coral)
            renderer.lineWidth = 4
            renderer.lineJoin = .round
            return renderer
        }
    }
}

private struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(HermesTheme.body)
                .foregroundStyle(HermesTheme.mutedInk)
            Spacer()
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(HermesTheme.ink)
        }
        .padding(.vertical, 12)
    }
}

struct RunDetailView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { RunDetailView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard), run: HermesPreviewFixtures.dashboard.activities[0]) }
    }
}
