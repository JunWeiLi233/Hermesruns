import SwiftUI

struct ShoesView: View {
    @ObservedObject var session: SessionStore
    @State private var editorMode: ShoeEditorMode?
    @State private var shoeToRetire: HermesShoe?
    @State private var actionError = ""

    private var snapshot: HermesDashboardSnapshot? {
        guard let dashboard = session.dashboard else { return nil }
        return HermesDashboardSnapshot(payload: dashboard)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Shoe rotation")
                Text("Run in the pair that fits the work.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)

                if let snapshot {
                    if let recommendation = snapshot.recommendedShoe {
                        RecommendedShoeView(shoe: recommendation)
                    }
                    if snapshot.activeShoes.isEmpty {
                        HermesCard {
                            Text("No active shoes are on your roster yet. Use the plus button to add your first pair.")
                                .font(HermesTheme.body)
                                .foregroundStyle(HermesTheme.mutedInk)
                        }
                    } else {
                        ForEach(Array(snapshot.activeShoes.enumerated()), id: \.offset) { _, shoe in
                            ShoeRotationCard(
                                shoe: shoe,
                                onEdit: { editorMode = .edit(shoe) },
                                onRetire: { shoeToRetire = shoe }
                            )
                        }
                    }
                } else if session.phase == .loading {
                    ProgressView()
                        .tint(HermesTheme.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else {
                    HermesCard {
                        Text("Sign in to view your shoe mileage and rotation guidance.")
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
        .navigationTitle("Shoes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    editorMode = .create
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add shoe")
                .disabled(!session.isAuthenticated)
            }
        }
        .sheet(item: $editorMode) { mode in
            ShoeEditorView(session: session, shoe: mode.shoe)
        }
        .alert("Retire shoe?", isPresented: Binding(
            get: { shoeToRetire != nil },
            set: { if !$0 { shoeToRetire = nil } }
        )) {
            Button("Retire", role: .destructive) {
                guard let id = shoeToRetire?.id else {
                    shoeToRetire = nil
                    actionError = "This shoe has no server identifier."
                    return
                }
                shoeToRetire = nil
                Task {
                    do {
                        try await session.retireShoe(id: id)
                    } catch {
                        actionError = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) { shoeToRetire = nil }
        } message: {
            Text("The shoe will leave your active rotation while keeping existing activity links intact.")
        }
        .alert("Shoe action failed", isPresented: Binding(
            get: { !actionError.isEmpty },
            set: { if !$0 { actionError = "" } }
        )) {
            Button("OK", role: .cancel) { actionError = "" }
        } message: {
            Text(actionError)
        }
        .refreshable { await session.refreshDashboard() }
        .task {
            if session.dashboard == nil { await session.refreshDashboard() }
        }
    }
}

private struct RecommendedShoeView: View {
    let shoe: HermesRecommendedShoe

    var body: some View {
        HermesCard(fill: HermesTheme.coralSoft) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HermesSectionLabel(text: "Today's pick")
                    Spacer()
                    Image(systemName: "sparkles")
                        .foregroundStyle(HermesTheme.coral)
                }
                Text([shoe.brand, shoe.model].compactMap { $0 }.joined(separator: " ").ifEmpty("Rotation pick"))
                    .font(HermesTheme.title)
                    .foregroundStyle(HermesTheme.ink)
                Text(shoe.recommendationReason ?? "Matched to today's workout and surface.")
                    .font(HermesTheme.body)
                    .foregroundStyle(HermesTheme.ink.opacity(0.67))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct ShoeRotationCard: View {
    let shoe: HermesShoe
    let onEdit: () -> Void
    let onRetire: () -> Void

    var body: some View {
        HermesCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    Image(systemName: "shoeprints.fill")
                        .foregroundStyle(HermesTheme.coral)
                        .frame(width: 42, height: 42)
                        .background(HermesTheme.coralSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(shoe.displayName)
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundStyle(HermesTheme.ink)
                        Text(shoe.type?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Daily trainer")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }
                    Spacer()
                    if shoe.isPrimary == true {
                        Text("Primary")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mintInk)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(HermesTheme.mint, in: Capsule())
                    }
                    Menu {
                        Button("Edit", action: onEdit)
                        Button("Retire", role: .destructive, action: onRetire)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 21, weight: .semibold))
                            .foregroundStyle(HermesTheme.mutedInk)
                            .accessibilityLabel("Manage \(shoe.displayName)")
                    }
                }
                HStack(spacing: 0) {
                    HermesMetric(value: HermesFormatters.distance(shoe.currentDistanceKm), label: "logged")
                    HermesMetric(value: HermesFormatters.distance(shoe.maxDistanceKm), label: "lifespan")
                    HermesMetric(value: shoe.daysSinceLastWear.map { "\($0)d" } ?? "—", label: "last worn")
                }
                ProgressView(value: shoe.healthPercent)
                    .tint(shoe.healthPercent >= 0.85 ? HermesTheme.coral : HermesTheme.mintInk)
                    .accessibilityLabel("Mileage used \(Int(shoe.healthPercent * 100)) percent")
            }
        }
    }
}

private enum ShoeEditorMode: Identifiable {
    case create
    case edit(HermesShoe)

    var id: String {
        switch self {
        case .create: return "create"
        case .edit(let shoe): return "edit-\(shoe.id ?? -1)"
        }
    }

    var shoe: HermesShoe? {
        switch self {
        case .create: return nil
        case .edit(let shoe): return shoe
        }
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}

struct ShoesView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { ShoesView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
