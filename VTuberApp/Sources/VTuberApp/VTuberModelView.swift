import SwiftUI
import RealityKit
import ARKit
import Combine

// MARK: - SwiftUI wrapper

struct VTuberModelView: UIViewRepresentable {
    @ObservedObject var viewModel: FaceTrackingViewModel

    func makeCoordinator() -> ModelCoordinator {
        ModelCoordinator()
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero, cameraMode: .nonAR, automaticallyConfigureSession: false)
        arView.environment.background = .color(UIColor(red: 0.05, green: 0.05, blue: 0.18, alpha: 1))
        arView.renderOptions = [.disableMotionBlur, .disableDepthOfField]

        context.coordinator.setup(in: arView, viewModel: viewModel)
        return arView
    }

    func updateUIView(_ arView: ARView, context: Context) {}
}

// MARK: - Scene coordinator

@MainActor
final class ModelCoordinator {
    private var entities: FaceEntities?
    private var subscription: Cancellable?
    private weak var viewModel: FaceTrackingViewModel?

    func setup(in arView: ARView, viewModel: FaceTrackingViewModel) {
        self.viewModel = viewModel

        let anchor = AnchorEntity(world: .zero)
        anchor.position = [0, 0, -0.55]

        let face = PlaceholderFaceModel.build()
        anchor.addChild(face.root)
        arView.scene.addAnchor(anchor)
        entities = face

        // Per-frame update via RealityKit scene event
        subscription = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in
            Task { @MainActor [weak self] in self?.tick() }
        }
    }

    // MARK: - Per-frame model update

    private func tick() {
        guard let vm = viewModel, let e = entities else { return }

        updateHeadRotation(e: e, vm: vm)
        updateEyes(e: e, vm: vm)
        updateMouth(e: e, vm: vm)
        updateBrows(e: e, vm: vm)
    }

    // ── Head rotation ──────────────────────────────────────────
    private func updateHeadRotation(e: FaceEntities, vm: FaceTrackingViewModel) {
        guard vm.isTracking else { return }
        let t = vm.headTransform

        // Extract Euler angles from face anchor transform
        let yaw   = atan2(t.columns.2.x, t.columns.0.x)
        let pitch = atan2(-t.columns.2.y, t.columns.2.z)
        let roll  = atan2(t.columns.1.x, t.columns.1.y)

        // Negate yaw for mirror effect (matching front camera preview)
        let q = simd_quatf(angle: -yaw,  axis: [0, 1, 0])
              * simd_quatf(angle:  pitch, axis: [1, 0, 0])
              * simd_quatf(angle:  roll,  axis: [0, 0, 1])

        e.root.transform.rotation = q
    }

    // ── Eye blink ─────────────────────────────────────────────
    private func updateEyes(e: FaceEntities, vm: FaceTrackingViewModel) {
        let lScale = max(0.08, 1.0 - vm.eyeBlinkLeft  * 0.92)
        let rScale = max(0.08, 1.0 - vm.eyeBlinkRight * 0.92)
        e.leftEye.scale  = [1, lScale, 1]
        e.rightEye.scale = [1, rScale, 1]

        // Wide-eye bulge
        let lWide = 1.0 + vm.eyeWideLeft  * 0.15
        let rWide = 1.0 + vm.eyeWideRight * 0.15
        e.leftEye.scale  *= [lWide, lWide, lWide]
        e.rightEye.scale *= [rWide, rWide, rWide]
    }

    // ── Beak (lower jaw moves down on jawOpen) ────────────────
    private func updateMouth(e: FaceEntities, vm: FaceTrackingViewModel) {
        e.mouth.position.y = e.mouthBaseY - vm.jawOpen * 0.025
    }

    // ── Eyebrows ──────────────────────────────────────────────
    private func updateBrows(e: FaceEntities, vm: FaceTrackingViewModel) {
        let lift: Float  = 0.025
        let frown: Float = 0.015

        e.leftBrow.position.y  = e.browBaseY
            + vm.browInnerUp      * lift
            + vm.browOuterUpLeft  * lift
            - vm.browDownLeft     * frown

        e.rightBrow.position.y = e.browBaseY
            + vm.browInnerUp       * lift
            + vm.browOuterUpRight  * lift
            - vm.browDownRight     * frown
    }
}
