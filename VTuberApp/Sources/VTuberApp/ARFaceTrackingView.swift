import ARKit

// Standalone ARSession for face tracking (no view required).
// Runs in background; pushes data into FaceTrackingViewModel.
final class FaceTrackingSession: NSObject, ObservableObject {
    private let session = ARSession()
    weak var viewModel: FaceTrackingViewModel?

    func start() {
        guard ARFaceTrackingConfiguration.isSupported else { return }
        let config = ARFaceTrackingConfiguration()
        config.maximumNumberOfTrackedFaces = 1
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func stop() {
        session.pause()
    }
}

extension FaceTrackingSession: ARSessionDelegate {
    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        guard let face = anchors.compactMap({ $0 as? ARFaceAnchor }).first else { return }
        DispatchQueue.main.async { [weak self] in
            self?.viewModel?.update(from: face)
        }
    }

    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        if anchors.contains(where: { $0 is ARFaceAnchor }) {
            DispatchQueue.main.async { [weak self] in
                self?.viewModel?.trackingLost()
            }
        }
    }
}
