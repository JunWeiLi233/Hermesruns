import SwiftUI

struct StravaSyncView: View {
    @ObservedObject var session: SessionStore
    @Environment(\.openURL) private var openURL

    @State private var isActioning = false
    @State private var notice = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Connected runs")
                Text("Keep your training history in sync.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if session.stravaLoading && session.stravaStatus == nil {
                    ProgressView()
                        .tint(HermesTheme.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else {
                    connectionCard
                    if let syncStatus = session.stravaStatus?.syncStatus {
                        syncCard(syncStatus)
                    }
                    if !notice.isEmpty {
                        Text(notice)
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let error = session.stravaErrorMessage, !error.isEmpty {
                        Text(error)
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.coral)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Strava")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await session.refreshStravaStatus() }
        .task {
            if session.stravaStatus == nil { await session.refreshStravaStatus() }
        }
    }

    private var connectionCard: some View {
        HermesCard(fill: HermesTheme.ink) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("Strava", systemImage: "arrow.triangle.2.circlepath")
                        .font(HermesTheme.title)
                        .foregroundStyle(.white)
                    Spacer()
                    Text(session.stravaStatus?.linked == true ? "CONNECTED" : "NOT CONNECTED")
                        .font(HermesTheme.section)
                        .tracking(0.8)
                        .foregroundStyle(session.stravaStatus?.linked == true ? HermesTheme.mint : HermesTheme.coralSoft)
                }
                Text(session.stravaStatus?.linked == true
                     ? "New runs can be imported without storing Strava credentials on this device."
                     : "Authorize Strava in a secure browser handoff. Hermes stores the provider token on the server.")
                    .font(HermesTheme.body)
                    .foregroundStyle(.white.opacity(0.78))
                    .fixedSize(horizontal: false, vertical: true)

                if session.stravaStatus?.linked == true {
                    Button {
                        startSync()
                    } label: {
                        HStack {
                            if isActioning { ProgressView().tint(.white) }
                            Text(isActioning ? "Syncing…" : "Sync recent runs")
                        }
                    }
                    .buttonStyle(HermesPrimaryButtonStyle())
                    .disabled(isActioning)
                } else if session.stravaStatus?.configured == false {
                    Text("Strava is not configured on this Hermes server.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coralSoft)
                } else {
                    Button {
                        connectStrava()
                    } label: {
                        HStack {
                            if isActioning { ProgressView().tint(.white) }
                            Text(isActioning ? "Opening…" : "Connect Strava")
                        }
                    }
                    .buttonStyle(HermesPrimaryButtonStyle())
                    .disabled(isActioning)
                }
            }
        }
    }

    private func syncCard(_ status: HermesStravaSyncStatus) -> some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 12) {
                HermesSectionLabel(text: "Latest sync")
                HStack(spacing: 0) {
                    HermesMetric(value: "\(status.importedRuns ?? 0)", label: "runs imported")
                    HermesMetric(value: "\(status.processedActivities ?? 0)", label: "activities")
                    HermesMetric(value: display(status.status ?? "IDLE"), label: "status")
                }
                if let error = status.error, !error.isEmpty {
                    Text(error)
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                        .fixedSize(horizontal: false, vertical: true)
                } else if status.active == true {
                    ProgressView("Import in progress…")
                        .tint(HermesTheme.coral)
                        .font(HermesTheme.caption)
                }
            }
        }
    }

    private func connectStrava() {
        guard !isActioning else { return }
        isActioning = true
        notice = ""
        Task {
            do {
                let url = try await session.requestStravaLinkURL()
                _ = openURL(url)
                notice = "Finish authorization in the browser, then return here and pull to refresh."
            } catch {
                notice = error.localizedDescription
            }
            isActioning = false
        }
    }

    private func startSync() {
        guard !isActioning else { return }
        isActioning = true
        notice = ""
        Task {
            do {
                let message = try await session.startStravaSync()
                notice = message.trimmingCharacters(in: .whitespacesAndNewlines)
                try await pollSync()
            } catch {
                notice = error.localizedDescription
            }
            isActioning = false
        }
    }

    private func pollSync() async throws {
        var sawActive = false
        for _ in 0..<20 {
            let status = try await session.refreshStravaSyncStatus()
            if status.active == true { sawActive = true }
            if status.status == "COMPLETED" || status.status == "FAILED" || (sawActive && status.active != true) {
                return
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }

    private func display(_ value: String) -> String {
        value.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct StravaSyncView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { StravaSyncView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
