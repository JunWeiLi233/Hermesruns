import SwiftUI
import UniformTypeIdentifiers

struct ImportDataView: View {
    @ObservedObject var session: SessionStore

    @State private var provider: HermesImportProvider = .exports
    @State private var selectedURLs: [URL] = []
    @State private var choosingFiles = false
    @State private var importing = false
    @State private var statusMessage = ""
    @State private var statusIsError = false

    private static let allowedExtensions: Set<String> = ["gpx", "tcx", "fit", "zip"]
    private static let allowedContentTypes: [UTType] = ["gpx", "tcx", "fit", "zip"].compactMap { UTType(filenameExtension: $0) }
    private static let maxFiles = 50
    private static let maxFileBytes = 20 * 1024 * 1024
    private static let maxBatchBytes = 50 * 1024 * 1024

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HermesSectionLabel(text: "Import workout data")
                Text("Bring GPX, TCX, FIT, or ZIP exports into your Hermes run library.")
                    .font(HermesTheme.title)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Files are read for this upload only and are not saved locally by the app. Choose one source per import.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)

                HermesCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Source")
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(HermesTheme.ink)
                        Picker("Source", selection: $provider) {
                            ForEach(HermesImportProvider.allCases) { source in
                                Text(source.title).tag(source)
                            }
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: provider) { _ in
                            selectedURLs = []
                            statusMessage = ""
                        }

                        Button {
                            choosingFiles = true
                        } label: {
                            Label("Choose files", systemImage: "doc.badge.plus")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(HermesTheme.coral)
                    }
                }

                if !selectedURLs.isEmpty {
                    HermesCard {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Selected")
                                    .font(.system(size: 14, weight: .bold, design: .rounded))
                                Spacer()
                                Text("\(selectedURLs.count) file\(selectedURLs.count == 1 ? "" : "s")")
                                    .font(HermesTheme.caption)
                                    .foregroundStyle(HermesTheme.mutedInk)
                            }
                            ForEach(selectedURLs, id: \.self) { url in
                                Label(url.lastPathComponent, systemImage: "doc")
                                    .font(HermesTheme.caption)
                                    .foregroundStyle(HermesTheme.ink)
                                    .lineLimit(1)
                            }
                        }
                    }
                }

                Button {
                    Task { await importSelectedFiles() }
                } label: {
                    HStack {
                        Text(importing ? "Importing…" : "Import into Hermes")
                        Spacer()
                        if importing { ProgressView().tint(.white) }
                    }
                }
                .buttonStyle(HermesPrimaryButtonStyle())
                .disabled(selectedURLs.isEmpty || importing)

                if !statusMessage.isEmpty {
                    Text(statusMessage)
                        .font(HermesTheme.caption)
                        .foregroundStyle(statusIsError ? HermesTheme.coral : HermesTheme.mintInk)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("Hermes accepts up to 50 files per batch, with a 20 MB per-file limit. Mobile imports are capped at 50 MB total.")
                    .font(HermesTheme.caption)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(18)
            .padding(.bottom, 30)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Import data")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $choosingFiles,
            allowedContentTypes: Self.allowedContentTypes,
            allowsMultipleSelection: true,
            onCompletion: handleFileSelection
        )
    }

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            let candidates = urls.filter { Self.allowedExtensions.contains($0.pathExtension.lowercased()) }
            guard candidates.count == urls.count, !candidates.isEmpty else {
                setError("Choose only GPX, TCX, FIT, or ZIP files.")
                return
            }
            guard candidates.count <= Self.maxFiles else {
                setError("Choose no more than 50 files per import.")
                return
            }
            let totalBytes = candidates.reduce(Int64(0)) { total, url in
                let fileSize = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
                return total + Int64(fileSize)
            }
            guard totalBytes <= Int64(Self.maxBatchBytes) else {
                setError("Keep a mobile import under 50 MB total.")
                return
            }
            selectedURLs = candidates
            statusMessage = "\(candidates.count) file\(candidates.count == 1 ? "" : "s") ready."
            statusIsError = false
        case .failure:
            setError("Unable to choose files.")
        }
    }

    private func importSelectedFiles() async {
        importing = true
        statusMessage = ""
        statusIsError = false
        do {
            let uploads = try readSelectedFiles()
            let result = try await session.importActivityFiles(uploads)
            let imported = result.importedActivities ?? 0
            let rejected = result.rejectedFiles?.count ?? 0
            if rejected > 0 {
                statusMessage = "Imported \(imported) run\(imported == 1 ? "" : "s"); \(rejected) file\(rejected == 1 ? "" : "s") rejected."
            } else {
                statusMessage = result.message ?? "Import completed."
            }
            selectedURLs = []
        } catch {
            setError(error is HermesAPIError ? error.localizedDescription : "Unable to read or import the selected files.")
        }
        importing = false
    }

    private func readSelectedFiles() throws -> [HermesImportUpload] {
        try selectedURLs.map { url in
            let accessed = url.startAccessingSecurityScopedResource()
            defer {
                if accessed { url.stopAccessingSecurityScopedResource() }
            }
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            guard !data.isEmpty, data.count <= Self.maxFileBytes else {
                throw HermesAPIError.server("Each workout file must be no larger than 20 MB.")
            }
            return HermesImportUpload(provider: provider, filename: url.lastPathComponent, data: data)
        }
    }

    private func setError(_ message: String) {
        statusMessage = message
        statusIsError = true
        selectedURLs = []
    }
}

struct ImportDataView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { ImportDataView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
