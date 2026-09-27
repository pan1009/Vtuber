import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = FaceTrackingViewModel()
    @StateObject private var session   = FaceTrackingSession()
    @State private var showDebug       = false

    var body: some View {
        ZStack {
            // ── Main: VTuber model ──────────────────────────────
            VTuberModelView(viewModel: viewModel)
                .ignoresSafeArea()

            // ── Tracking lost indicator ─────────────────────────
            if !viewModel.isTracking {
                VStack {
                    Image(systemName: "camera.metering.spot")
                        .font(.system(size: 40))
                        .foregroundColor(.white.opacity(0.6))
                    Text("顔を向けてください")
                        .foregroundColor(.white.opacity(0.6))
                        .font(.caption)
                }
            }

            // ── Debug panel (toggle) ────────────────────────────
            VStack {
                HStack {
                    Spacer()
                    Button {
                        withAnimation { showDebug.toggle() }
                    } label: {
                        Image(systemName: "info.circle")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.7))
                            .padding(12)
                    }
                }
                Spacer()
                if showDebug {
                    DebugPanel(viewModel: viewModel)
                        .padding(.horizontal)
                        .padding(.bottom, 20)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .statusBarHidden()
        .onAppear {
            session.viewModel = viewModel
            session.start()
        }
        .onDisappear {
            session.stop()
        }
    }
}

// MARK: - Debug Panel

private struct DebugPanel: View {
    @ObservedObject var viewModel: FaceTrackingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Face Tracking Debug")
                .font(.caption.bold())
                .foregroundColor(.white)

            HStack(spacing: 12) {
                BarItem("JawOpen",   viewModel.jawOpen)
                BarItem("BlinkL",    viewModel.eyeBlinkLeft)
                BarItem("BlinkR",    viewModel.eyeBlinkRight)
            }
            HStack(spacing: 12) {
                BarItem("SmileL",    viewModel.mouthSmileLeft)
                BarItem("SmileR",    viewModel.mouthSmileRight)
                BarItem("BrowUp",    viewModel.browInnerUp)
            }

            Text(String(
                format: "Yaw: %+.1f°  Pitch: %+.1f°  Roll: %+.1f°",
                viewModel.headYaw, viewModel.headPitch, viewModel.headRoll
            ))
            .font(.caption2.monospacedDigit())
            .foregroundColor(.yellow)
        }
        .padding(10)
        .background(.black.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct BarItem: View {
    let label: String
    let value: Float
    init(_ label: String, _ value: Float) {
        self.label = label; self.value = value
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundColor(.gray)
            ProgressView(value: Double(value))
                .frame(width: 75)
                .tint(value > 0.5 ? .green : .cyan)
            Text(String(format: "%.2f", value))
                .font(.caption2.monospacedDigit())
                .foregroundColor(.white)
        }
    }
}
