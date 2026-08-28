import SwiftUI

enum HermesTheme {
    static let paper = Color(red: 0.965, green: 0.949, blue: 0.918)
    static let paperRaised = Color(red: 0.992, green: 0.985, blue: 0.969)
    static let ink = Color(red: 0.075, green: 0.082, blue: 0.075)
    static let mutedInk = Color(red: 0.38, green: 0.39, blue: 0.35)
    static let coral = Color(red: 0.941, green: 0.337, blue: 0.239)
    static let coralSoft = Color(red: 0.991, green: 0.833, blue: 0.78)
    static let mint = Color(red: 0.72, green: 0.87, blue: 0.76)
    static let mintInk = Color(red: 0.12, green: 0.32, blue: 0.20)
    static let line = Color.black.opacity(0.08)

    static let display = Font.system(size: 32, weight: .black, design: .rounded)
    static let title = Font.system(size: 22, weight: .bold, design: .rounded)
    static let section = Font.system(size: 13, weight: .bold, design: .rounded)
    static let body = Font.system(size: 15, weight: .regular, design: .rounded)
    static let caption = Font.system(size: 12, weight: .medium, design: .rounded)
}

struct HermesCard<Content: View>: View {
    private let content: Content
    private let fill: Color

    init(fill: Color = HermesTheme.paperRaised, @ViewBuilder content: () -> Content) {
        self.fill = fill
        self.content = content()
    }

    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct HermesSectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(HermesTheme.section)
            .tracking(1.1)
            .foregroundStyle(HermesTheme.mutedInk)
    }
}

struct HermesMetric: View {
    let value: String
    let label: String
    let valueColor: Color
    let labelColor: Color

    init(value: String, label: String, valueColor: Color = HermesTheme.ink, labelColor: Color = HermesTheme.mutedInk) {
        self.value = value
        self.label = label
        self.valueColor = valueColor
        self.labelColor = labelColor
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.system(size: 19, weight: .bold, design: .rounded))
                .foregroundStyle(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .tracking(0.8)
                .foregroundStyle(labelColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct HermesPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(HermesTheme.ink.opacity(configuration.isPressed ? 0.78 : 1), in: Capsule())
    }
}

struct ReadinessRing: View {
    let score: Int

    var body: some View {
        ZStack {
            Circle()
                .stroke(HermesTheme.ink.opacity(0.12), lineWidth: 13)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(HermesTheme.coral, style: StrokeStyle(lineWidth: 13, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(.system(size: 38, weight: .black, design: .rounded))
                    .foregroundStyle(HermesTheme.ink)
                Text("/100")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(HermesTheme.mutedInk)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Readiness score \(score) out of 100")
    }
}
