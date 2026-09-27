import RealityKit
import UIKit
import simd

struct FaceEntities {
    let root: Entity
    let head: ModelEntity
    let leftEye: ModelEntity
    let rightEye: ModelEntity
    let mouth: ModelEntity      // = lower beak (moves down on jawOpen)
    let leftBrow: ModelEntity   // = left ear tuft (moves up on brow raise)
    let rightBrow: ModelEntity  // = right ear tuft

    let mouthBaseY: Float       // resting Y of lower beak
    let browBaseY: Float        // resting Y of ear tufts
}

// Builds an owl VTuber character from RealityKit primitives.
// All shapes are UnlitMaterial (no lights needed).
enum PlaceholderFaceModel {
    static func build() -> FaceEntities {
        let root = Entity()

        // ── Body ─────────────────────────────────────────────
        let body = ModelEntity(
            mesh: .generateSphere(radius: 0.5),
            materials: [unlit(.owlBrown)]
        )
        body.scale    = [0.22, 0.26, 0.14]
        body.position = [0, -0.20, -0.04]
        root.addChild(body)

        // ── Head ──────────────────────────────────────────────
        let head = ModelEntity(
            mesh: .generateSphere(radius: 0.14),
            materials: [unlit(.owlBrown)]
        )
        root.addChild(head)

        // ── Face disc (flat pale ellipse) ─────────────────────
        let disc = ModelEntity(
            mesh: .generateSphere(radius: 0.5),
            materials: [unlit(.cream)]
        )
        disc.scale    = [0.28, 0.26, 0.04]
        disc.position = [0, 0.005, 0.095]
        head.addChild(disc)

        // ── Eye rings (dark feather circles) ──────────────────
        let lRing = ModelEntity(mesh: .generateSphere(radius: 0.060), materials: [unlit(.eyeRing)])
        lRing.position = [-0.072, 0.022, 0.118]
        head.addChild(lRing)

        let rRing = ModelEntity(mesh: .generateSphere(radius: 0.060), materials: [unlit(.eyeRing)])
        rRing.position = [0.072, 0.022, 0.118]
        head.addChild(rRing)

        // ── Eyes (white sclera – large owl eyes) ──────────────
        let leftEye = ModelEntity(mesh: .generateSphere(radius: 0.048), materials: [unlit(.almostWhite)])
        leftEye.position = [-0.072, 0.022, 0.134]
        head.addChild(leftEye)

        let rightEye = ModelEntity(mesh: .generateSphere(radius: 0.048), materials: [unlit(.almostWhite)])
        rightEye.position = [0.072, 0.022, 0.134]
        head.addChild(rightEye)

        // ── Pupils (large, owl-like) ───────────────────────────
        let lPupil = ModelEntity(mesh: .generateSphere(radius: 0.030), materials: [unlit(.black)])
        lPupil.position = [0, 0, 0.036]
        leftEye.addChild(lPupil)

        let rPupil = ModelEntity(mesh: .generateSphere(radius: 0.030), materials: [unlit(.black)])
        rPupil.position = [0, 0, 0.036]
        rightEye.addChild(rPupil)

        // ── Eye highlights (cute glint) ────────────────────────
        for eye in [leftEye, rightEye] {
            let glint = ModelEntity(mesh: .generateSphere(radius: 0.009), materials: [unlit(.white)])
            glint.position = [0.016, 0.016, 0.048]
            eye.addChild(glint)
        }

        // ── Upper beak (fixed) ────────────────────────────────
        let upperBeak = ModelEntity(
            mesh: .generateBox(size: [0.044, 0.022, 0.020]),
            materials: [unlit(.beak)]
        )
        upperBeak.position = [0, -0.040, 0.142]
        head.addChild(upperBeak)

        // ── Lower beak (jaw open: moves down) ─────────────────
        let lowerBeakY: Float = -0.060
        let lowerBeak = ModelEntity(
            mesh: .generateBox(size: [0.034, 0.016, 0.018]),
            materials: [unlit(.beak)]
        )
        lowerBeak.position = [0, lowerBeakY, 0.140]
        head.addChild(lowerBeak)

        // ── Ear tufts ─────────────────────────────────────────
        let tuftY: Float = 0.155
        let leftTuft  = tuftEntity(flipped: false)
        leftTuft.position  = [-0.065, tuftY, 0.055]
        head.addChild(leftTuft)

        let rightTuft = tuftEntity(flipped: true)
        rightTuft.position = [ 0.065, tuftY, 0.055]
        head.addChild(rightTuft)

        return FaceEntities(
            root: root,
            head: head,
            leftEye: leftEye,
            rightEye: rightEye,
            mouth: lowerBeak,
            leftBrow: leftTuft,
            rightBrow: rightTuft,
            mouthBaseY: lowerBeakY,
            browBaseY: tuftY
        )
    }

    // MARK: - Helpers

    private static func tuftEntity(flipped: Bool) -> ModelEntity {
        let e = ModelEntity(
            mesh: .generateBox(size: [0.016, 0.060, 0.010]),
            materials: [unlit(.darkBrown)]
        )
        let angle: Float = flipped ? .pi / 14 : -.pi / 14   // ~13° tilt outward
        e.transform.rotation = simd_quatf(angle: angle, axis: [0, 0, 1])
        return e
    }

    private static func unlit(_ color: UIColor) -> UnlitMaterial {
        var mat = UnlitMaterial()
        mat.color = .init(tint: color, texture: nil)
        return mat
    }
}

// MARK: - Palette

private extension UIColor {
    static let owlBrown  = UIColor(red: 0.52, green: 0.36, blue: 0.18, alpha: 1)
    static let cream     = UIColor(red: 0.97, green: 0.93, blue: 0.82, alpha: 1)
    static let eyeRing   = UIColor(red: 0.28, green: 0.16, blue: 0.06, alpha: 1)
    static let almostWhite = UIColor(red: 0.97, green: 0.96, blue: 0.92, alpha: 1)
    static let beak      = UIColor(red: 0.92, green: 0.68, blue: 0.12, alpha: 1)
    static let darkBrown = UIColor(red: 0.22, green: 0.13, blue: 0.04, alpha: 1)
}
