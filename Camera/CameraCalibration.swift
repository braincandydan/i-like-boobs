import AVFoundation
import simd

/// Intrinsic parameters for one camera at a given resolution.
struct CameraIntrinsics {
    var fx: Float
    var fy: Float
    var cx: Float
    var cy: Float
    var width:  Int
    var height: Int

    /// Scale intrinsics proportionally to a new working resolution.
    func scaled(to size: CGSize) -> CameraIntrinsics {
        let sx = Float(size.width)  / Float(width)
        let sy = Float(size.height) / Float(height)
        return CameraIntrinsics(fx: fx * sx, fy: fy * sy,
                                cx: cx * sx, cy: cy * sy,
                                width: Int(size.width), height: Int(size.height))
    }
}

/// Extrinsic baseline (metres) and rotation between two cameras.
struct StereoExtrinsics {
    /// Translation vector from camera A to camera B (metres).
    var baseline: simd_float3
    /// Rotation matrix (3×3, row-major) from camera A to camera B.
    var rotation: simd_float3x3
}

// MARK: – Hardcoded baselines

enum CameraRole { case wide, ultrawide, telephoto }

struct HardcodedExtrinsics {
    /// Wide → Ultrawide translation, metres.
    static let wideToUltrawide = StereoExtrinsics(
        baseline: simd_float3(0.011, 0, 0),   // ~11 mm
        rotation: matrix_identity_float3x3
    )
    /// Wide → Telephoto translation, metres.
    static let wideToTelephoto = StereoExtrinsics(
        baseline: simd_float3(0.017, 0, 0),   // ~17 mm
        rotation: matrix_identity_float3x3
    )
}

// MARK: – Calibration manager

final class CameraCalibration {
    private let defaults = UserDefaults.standard
    private let modelIdentifier: String

    private(set) var wideIntrinsics:      CameraIntrinsics?
    private(set) var ultrawideIntrinsics: CameraIntrinsics?
    private(set) var telephotoIntrinsics: CameraIntrinsics?

    var wideToUltrawideExtrinsics: StereoExtrinsics { loadOrDefault(key: "stereo_uw") ?? HardcodedExtrinsics.wideToUltrawide }
    var wideToTelephotoExtrinsics: StereoExtrinsics { loadOrDefault(key: "stereo_tele") ?? HardcodedExtrinsics.wideToTelephoto }

    init() {
        var sysinfo = utsname()
        uname(&sysinfo)
        modelIdentifier = withUnsafeBytes(of: &sysinfo.machine) { buf in
            String(cString: buf.baseAddress!.assumingMemoryBound(to: CChar.self))
        }
        print("[CameraCalibration] device model: \(modelIdentifier)")
    }

    // MARK: – Intrinsic extraction from sample buffer

    func update(sampleBuffer: CMSampleBuffer, role: CameraRole) {
        guard let matrix = sampleBuffer.cameraIntrinsicMatrix else { return }

        let dims = CMVideoFormatDescriptionGetDimensions(sampleBuffer.formatDescription!)
        let intrinsics = CameraIntrinsics(
            fx: matrix.columns.0.x,
            fy: matrix.columns.1.y,
            cx: matrix.columns.2.x,
            cy: matrix.columns.2.y,
            width:  Int(dims.width),
            height: Int(dims.height)
        )

        switch role {
        case .wide:       wideIntrinsics      = intrinsics
        case .ultrawide:  ultrawideIntrinsics  = intrinsics
        case .telephoto:  telephotoIntrinsics  = intrinsics
        }

        print(String(format: "[CameraCalibration] %@ intrinsics — fx=%.1f fy=%.1f cx=%.1f cy=%.1f @ %dx%d",
                     "\(role)", intrinsics.fx, intrinsics.fy,
                     intrinsics.cx, intrinsics.cy,
                     intrinsics.width, intrinsics.height))
    }

    // MARK: – Persistence of stereoCalibrate results

    func persist(wideToUltrawide extrinsics: StereoExtrinsics) {
        save(extrinsics, key: perDeviceKey("stereo_uw"))
    }

    func persist(wideToTelephoto extrinsics: StereoExtrinsics) {
        save(extrinsics, key: perDeviceKey("stereo_tele"))
    }

    // MARK: – Private helpers

    private func perDeviceKey(_ base: String) -> String { "\(base)_\(modelIdentifier)" }

    private func loadOrDefault(key: String) -> StereoExtrinsics? {
        guard let data = defaults.data(forKey: perDeviceKey(key)),
              let stored = try? JSONDecoder().decode(StoredExtrinsics.self, from: data) else { return nil }
        print("[CameraCalibration] loaded persisted extrinsics for key \(key)")
        return stored.toExtrinsics()
    }

    private func save(_ extrinsics: StereoExtrinsics, key: String) {
        if let data = try? JSONEncoder().encode(StoredExtrinsics(from: extrinsics)) {
            defaults.set(data, forKey: key)
        }
    }
}

// MARK: – Codable wrapper

private struct StoredExtrinsics: Codable {
    var tx, ty, tz: Float
    var r00, r01, r02, r10, r11, r12, r20, r21, r22: Float

    init(from e: StereoExtrinsics) {
        tx = e.baseline.x; ty = e.baseline.y; tz = e.baseline.z
        r00 = e.rotation.columns.0.x; r01 = e.rotation.columns.1.x; r02 = e.rotation.columns.2.x
        r10 = e.rotation.columns.0.y; r11 = e.rotation.columns.1.y; r12 = e.rotation.columns.2.y
        r20 = e.rotation.columns.0.z; r21 = e.rotation.columns.1.z; r22 = e.rotation.columns.2.z
    }

    func toExtrinsics() -> StereoExtrinsics {
        StereoExtrinsics(
            baseline: simd_float3(tx, ty, tz),
            rotation: simd_float3x3(columns: (
                simd_float3(r00, r10, r20),
                simd_float3(r01, r11, r21),
                simd_float3(r02, r12, r22)
            ))
        )
    }
}

// MARK: – CMSampleBuffer helper

private extension CMSampleBuffer {
    var cameraIntrinsicMatrix: matrix_float3x3? {
        guard let attachment = CMGetAttachment(self,
                                               key: kCMSampleBufferAttachmentKey_CameraIntrinsicMatrix,
                                               attachmentModeOut: nil) else { return nil }
        guard let data = attachment as? Data, data.count == MemoryLayout<matrix_float3x3>.size else { return nil }
        return data.withUnsafeBytes { $0.load(as: matrix_float3x3.self) }
    }
}
