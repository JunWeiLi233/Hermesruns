import Foundation
import SwiftUI

struct WeatherView: View {
    @ObservedObject var session: SessionStore

    private var weather: HermesWeatherContext? { session.dashboard?.weather }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Weather context")
                Text("Let the conditions shape the effort.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let weather {
                    HermesCard(fill: weather.climateShockEvent == true ? HermesTheme.coralSoft : HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(weather.available == true ? "ACCLIMATIZATION ACTIVE" : "WEATHER DATA PENDING")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(weather.climateShockEvent == true ? HermesTheme.coral : HermesTheme.coralSoft)
                            Text(weather.message ?? "Hermes will apply weather context when a valid location is available.")
                                .font(HermesTheme.title)
                                .foregroundStyle(weather.climateShockEvent == true ? HermesTheme.ink : .white)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    HermesCard {
                        HStack(spacing: 0) {
                            HermesMetric(value: dewPoint(weather.currentDewPointC), label: "current dew point")
                            HermesMetric(value: dewPoint(weather.baselineDewPoint14dC), label: "14-day baseline")
                            HermesMetric(value: penalty(weather.pacePenaltySecPerKm), label: "pace adjustment")
                        }
                    }
                    if let status = weather.acclimatizationStatus, !status.isEmpty {
                        Text("Status: \(status.capitalized)")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                } else {
                    HermesCard {
                        Text("No weather context was returned for this session.")
                            .font(HermesTheme.body)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Weather")
        .navigationBarTitleDisplayMode(.inline)
        .task { if session.dashboard == nil { await session.refreshDashboard() } }
    }

    private func dewPoint(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f°C", value)
    }

    private func penalty(_ value: Int?) -> String {
        guard let value else { return "—" }
        return value == 0 ? "None" : "+\(value)s/km"
    }
}

struct WeatherView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { WeatherView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
