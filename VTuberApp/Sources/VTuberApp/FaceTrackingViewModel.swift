import ARKit
import simd

@MainActor
final class FaceTrackingViewModel: ObservableObject {
    // MARK: - Blend shapes
    @Published var jawOpen: Float          = 0
    @Published var eyeBlinkLeft: Float     = 0
    @Published var eyeBlinkRight: Float    = 0
    @Published var eyeWideLeft: Float      = 0
    @Published var eyeWideRight: Float     = 0
    @Published var mouthSmileLeft: Float   = 0
    @Published var mouthSmileRight: Float  = 0
    @Published var browInnerUp: Float      = 0
    @Published var browDownLeft: Float     = 0
    @Published var browDownRight: Float    = 0
    @Published var browOuterUpLeft: Float  = 0
    @Published var browOuterUpRight: Float = 0
    @Published var cheekPuff: Float        = 0
    @Published var mouthFunnel: Float      = 0
    @Published var mouthPucker: Float      = 0
    @Published var tongueOut: Float        = 0

    // MARK: - Head pose (raw 4×4 from ARFaceAnchor)
    @Published var headTransform: simd_float4x4 = matrix_identity_float4x4

    // Euler angles in degrees (for debug display)
    @Published var headYaw: Float   = 0
    @Published var headPitch: Float = 0
    @Published var headRoll: Float  = 0

    // MARK: - State
    @Published var isTracking: Bool = false

    // MARK: - Update

    func update(from anchor: ARFaceAnchor) {
        let bs = anchor.blendShapes
        jawOpen          = bs[.jawOpen]?.floatValue          ?? 0
        eyeBlinkLeft     = bs[.eyeBlinkLeft]?.floatValue     ?? 0
        eyeBlinkRight    = bs[.eyeBlinkRight]?.floatValue    ?? 0
        eyeWideLeft      = bs[.eyeWideLeft]?.floatValue      ?? 0
        eyeWideRight     = bs[.eyeWideRight]?.floatValue     ?? 0
        mouthSmileLeft   = bs[.mouthSmileLeft]?.floatValue   ?? 0
        mouthSmileRight  = bs[.mouthSmileRight]?.floatValue  ?? 0
        browInnerUp      = bs[.browInnerUp]?.floatValue      ?? 0
        browDownLeft     = bs[.browDownLeft]?.floatValue     ?? 0
        browDownRight    = bs[.browDownRight]?.floatValue    ?? 0
        browOuterUpLeft  = bs[.browOuterUpLeft]?.floatValue  ?? 0
        browOuterUpRight = bs[.browOuterUpRight]?.floatValue ?? 0
        cheekPuff        = bs[.cheekPuff]?.floatValue        ?? 0
        mouthFunnel      = bs[.mouthFunnel]?.floatValue      ?? 0
        mouthPucker      = bs[.mouthPucker]?.floatValue      ?? 0
        tongueOut        = bs[.tongueOut]?.floatValue        ?? 0

        let t = anchor.transform
        headTransform = t
        headYaw   = atan2(t.columns.2.x, t.columns.0.x) * (180 / .pi)
        headPitch = atan2(-t.columns.2.y, t.columns.2.z) * (180 / .pi)
        headRoll  = atan2(t.columns.1.x, t.columns.1.y)  * (180 / .pi)

        isTracking = true
    }

    func trackingLost() {
        isTracking = false
    }
}
