import SwiftUI

struct ForgotPasswordView: View {
    @ObservedObject var session: SessionStore
    @State private var email = ""
    @State private var serverURL: String
    @State private var isSubmitting = false
    @State private var message = ""
    @State private var errorMessage = ""

    init(session: SessionStore) {
        self.session = session
        _serverURL = State(initialValue: session.apiBaseURL)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HermesSectionLabel(text: "Account recovery")
                Text("Reset your password.")
                    .font(HermesTheme.display)
                    .foregroundStyle(HermesTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Enter your Hermes email and we’ll send a reset link when an account matches. For privacy, the response is intentionally the same either way.")
                    .font(HermesTheme.body)
                    .foregroundStyle(HermesTheme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 14) {
                    HermesSectionLabel(text: "Email")
                    TextField("runner@hermes.io", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                        .hermesRecoveryInput()
                }

                VStack(alignment: .leading, spacing: 10) {
                    HermesSectionLabel(text: "Hermes server")
                    TextField("http://localhost:8080", text: $serverURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .hermesRecoveryInput()
                }

                Button {
                    submit()
                } label: {
                    HStack {
                        if isSubmitting { ProgressView().tint(.white) }
                        Text(isSubmitting ? "Sending…" : "Send reset link")
                    }
                }
                .buttonStyle(HermesPrimaryButtonStyle())
                .disabled(isSubmitting || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .opacity(isSubmitting ? 0.55 : 1)

                if !message.isEmpty {
                    HermesCard(fill: HermesTheme.mint) {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .font(HermesTheme.body)
                            .foregroundStyle(HermesTheme.mintInk)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if !errorMessage.isEmpty {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 24)
            .padding(.bottom, 32)
        }
        .background(HermesTheme.paper.ignoresSafeArea())
        .navigationTitle("Recover access")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() {
        guard !isSubmitting else { return }
        guard session.updateAPIBaseURL(serverURL) else {
            errorMessage = session.errorMessage ?? "Enter a valid Hermes server URL."
            return
        }

        message = ""
        errorMessage = ""
        isSubmitting = true
        Task {
            do {
                try await session.requestPasswordReset(email: email)
                message = "If an account exists for that email, a reset link has been sent."
            } catch {
                errorMessage = error.localizedDescription
            }
            isSubmitting = false
        }
    }
}

private extension View {
    func hermesRecoveryInput() -> some View {
        self
            .font(HermesTheme.body)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(HermesTheme.paperRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(HermesTheme.line, lineWidth: 1))
    }
}

struct ForgotPasswordView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack { ForgotPasswordView(session: SessionStore(previewDashboard: HermesPreviewFixtures.dashboard)) }
    }
}
