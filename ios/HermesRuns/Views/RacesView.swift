import Foundation
import SwiftUI

struct RacesView: View {
    @ObservedObject var session: SessionStore
    @State private var editorMode: RaceEditorMode?
    @State private var raceToDelete: HermesRace?
    @State private var actionError = ""

    private var races: [HermesRace] {
        guard let dashboard = session.dashboard else { return [] }
        return dashboard.races
            .filter { $0.canceled != true }
            .sorted { (HermesDate.parse($0.eventDate) ?? .distantFuture) < (HermesDate.parse($1.eventDate) ?? .distantFuture) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Race center")
                Text("Give the next finish line a place in the plan.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if races.isEmpty {
                    HermesCard(fill: HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("NO TARGET RACE YET")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(HermesTheme.coralSoft)
                            Text("Add a race in the Hermes web app and it will appear here with its countdown and training context.")
                                .font(HermesTheme.body)
                                .foregroundStyle(.white.opacity(0.76))
                        }
                    }
                } else {
                    ForEach(Array(races.enumerated()), id: \.offset) { _, race in
                        RaceCard(
                            session: session,
                            race: race,
                            onEdit: { editorMode = .edit(race) },
                            onDelete: { raceToDelete = race }
                        )
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Races")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    editorMode = .create
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add race")
                .disabled(!session.isAuthenticated)
            }
        }
        .sheet(item: $editorMode) { mode in
            RaceEditorView(session: session, race: mode.race)
        }
        .alert("Delete race?", isPresented: Binding(
            get: { raceToDelete != nil },
            set: { if !$0 { raceToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let id = raceToDelete?.id else {
                    raceToDelete = nil
                    actionError = "This race has no server identifier."
                    return
                }
                raceToDelete = nil
                Task {
                    do {
                        try await session.deleteRace(id: id)
                    } catch {
                        actionError = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) { raceToDelete = nil }
        } message: {
            Text("This removes the saved target race and asks Hermes to replan the future schedule.")
        }
        .alert("Race action failed", isPresented: Binding(
            get: { !actionError.isEmpty },
            set: { if !$0 { actionError = "" } }
        )) {
            Button("OK", role: .cancel) { actionError = "" }
        } message: {
            Text(actionError)
        }
        .refreshable { await session.refreshDashboard() }
        .task { if session.dashboard == nil { await session.refreshDashboard() } }
    }
}

private struct RaceCard: View {
    @ObservedObject var session: SessionStore
    let race: HermesRace
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    Image(systemName: "flag.checkered")
                        .foregroundStyle(HermesTheme.coral)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(race.name?.isEmpty == false ? race.name! : "Target race")
                            .font(HermesTheme.title)
                            .foregroundStyle(HermesTheme.ink)
                        Text(race.location?.isEmpty == false ? race.location! : "Location not set")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                    Spacer()
                    Text(countdown)
                        .font(.system(size: 17, weight: .black, design: .rounded))
                        .foregroundStyle(HermesTheme.coral)
                    Menu {
                        Button("Edit", action: onEdit)
                        Button("Delete", role: .destructive, action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 21, weight: .semibold))
                            .foregroundStyle(HermesTheme.mutedInk)
                            .accessibilityLabel("Manage race")
                    }
                }
                HStack(spacing: 0) {
                    HermesMetric(value: HermesFormatters.date(HermesDate.parse(race.eventDate)), label: "race date")
                    HermesMetric(value: HermesFormatters.distance(race.distanceKm), label: "distance")
                    HermesMetric(value: race.eventDate == nil ? "—" : "target", label: "status")
                }
                NavigationLink(destination: RaceDetailView(session: session, race: race)) {
                    Label("Course and race detail", systemImage: "map")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(HermesTheme.coral)
                }
            }
        }
    }

    private var countdown: String {
        guard let date = HermesDate.parse(race.eventDate) else { return "—" }
        let days = Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0
        if days < 0 { return "Past" }
        return "D-\(days)"
    }
}

private enum RaceEditorMode: Identifiable {
    case create
    case edit(HermesRace)

    var id: String {
        switch self {
        case .create: return "create"
        case .edit(let race): return "edit-\(race.id ?? -1)"
        }
    }

    var race: HermesRace? {
        switch self {
        case .create: return nil
        case .edit(let race): return race
        }
    }
}

struct RacesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { RacesView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
