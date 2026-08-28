import SwiftUI

struct LoginView: View {
    @ObservedObject var session: SessionStore
    @Environment(\.openURL) private var openURL
    @State private var email = ""
    @State private var password = ""
    @State private var serverURL: String

    init(session: SessionStore) {
        self.session = session
        _serverURL = State(initialValue: session.apiBaseURL)
    }

    private var isBusy: Bool { session.phase == .loading }
    private var canSubmit: Bool { !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !password.isEmpty && !isBusy }

    var body: some View {
        ZStack {
            HermesTheme.paper.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("HERMES")
                            .font(.system(size: 42, weight: .black, design: .rounded))
                            .tracking(2.5)
                            .foregroundStyle(HermesTheme.ink)
                        Text("YOUR NEXT RUN, WITH CONTEXT.")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .tracking(1.1)
                            .foregroundStyle(HermesTheme.coral)
                    }
                    .padding(.top, 42)

                    HermesCard(fill: HermesTheme.ink) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("LOCAL-FIRST COACHING")
                                .font(HermesTheme.section)
                                .tracking(1)
                                .foregroundStyle(HermesTheme.coralSoft)
                            Text("Know whether today is a build day, an easy day, or a recovery day.")
                                .font(.system(size: 23, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                        }
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        HermesSectionLabel(text: "Sign in")
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textContentType(.username)
                            .hermesInput()
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                            .hermesInput()
                            .onSubmit { submit() }
                        Button(action: submit) {
                            HStack {
                                if isBusy { ProgressView().tint(.white) }
                                Text(isBusy ? "Connecting…" : "Enter Hermes")
                            }
                        }
                        .buttonStyle(HermesPrimaryButtonStyle())
                        .disabled(!canSubmit)
                        .opacity(canSubmit ? 1 : 0.5)
                        NavigationLink {
                            ForgotPasswordView(session: session)
                        } label: {
                            Text("Forgot password?")
                                .font(HermesTheme.caption)
                                .foregroundStyle(HermesTheme.coral)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        Button("Create a Hermes account") {
                            openSignup()
                        }
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.coral)
                        .frame(maxWidth: .infinity, alignment: .center)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        HermesSectionLabel(text: "Hermes server")
                        TextField("http://localhost:8080", text: $serverURL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .hermesInput()
                        Text("Use your deployed Hermes URL on a physical device. The simulator can reach a Mac-hosted local server through localhost.")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.mutedInk)
                    }

                    if let error = session.errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(HermesTheme.caption)
                            .foregroundStyle(HermesTheme.coral)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Text("Hermes uses the existing Spring Boot API. Your session token is stored in the iOS Keychain.")
                        .font(HermesTheme.caption)
                        .foregroundStyle(HermesTheme.mutedInk)
                        .padding(.top, 10)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 30)
            }
        }
    }

    private func submit() {
        guard canSubmit else { return }
        guard session.updateAPIBaseURL(serverURL) else { return }
        Task { await session.login(email: email, password: password) }
    }

    private func openSignup() {
        guard let url = URL(string: session.apiBaseURL)?.appendingPathComponent("signup") else { return }
        _ = openURL(url)
    }
}

private extension View {
    func hermesInput() -> some View {
        self
            .font(HermesTheme.body)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(HermesTheme.paperRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(HermesTheme.line, lineWidth: 1))
    }
}
