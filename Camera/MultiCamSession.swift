import AVFoundation
import Combine

enum SessionState {
    case idle
    case running
    case failed(Error)
}

final class MultiCamSession: NSObject, ObservableObject {
    @Published private(set) var state: SessionState = .idle

    let avSession = AVCaptureMultiCamSession()

    // Outputs exposed for FrameSynchroniser
    let wideOutput     = AVCaptureVideoDataOutput()
    let ultrawideOutput = AVCaptureVideoDataOutput()
    let telephotOutput = AVCaptureVideoDataOutput()

    private(set) var widePreviewLayer: AVCaptureVideoPreviewLayer?

    override init() {
        super.init()
        guard AVCaptureMultiCamSession.isMultiCamSupported else { return }
        configure()
    }

    func start() {
        guard AVCaptureMultiCamSession.isMultiCamSupported else { return }
        avSession.startRunning()
        DispatchQueue.main.async { self.state = .running }
        print("[MultiCamSession] session started")
    }

    func stop() {
        avSession.stopRunning()
        DispatchQueue.main.async { self.state = .idle }
    }

    // MARK: – Private

    private func configure() {
        avSession.beginConfiguration()
        defer { avSession.commitConfiguration() }

        do {
            try addCamera(position: .back, deviceType: .builtInWideAngleCamera,    output: wideOutput)
            try addCamera(position: .back, deviceType: .builtInUltraWideCamera,    output: ultrawideOutput)
            try addCamera(position: .back, deviceType: .builtInTelephotoCamera,    output: telephotOutput)
        } catch {
            DispatchQueue.main.async { self.state = .failed(error) }
            print("[MultiCamSession] configuration failed: \(error)")
            return
        }

        // Wide camera preview
        let preview = AVCaptureVideoPreviewLayer(session: avSession)
        preview.videoGravity = .resizeAspectFill
        widePreviewLayer = preview
    }

    private func addCamera(position: AVCaptureDevice.Position,
                           deviceType: AVCaptureDevice.DeviceType,
                           output: AVCaptureVideoDataOutput) throws {
        guard let device = AVCaptureDevice.default(deviceType, for: .video, position: position) else {
            throw ConfigError.deviceNotFound(deviceType)
        }

        // Pick best 4:3 multi-cam format at highest resolution
        if let format = bestFormat(for: device) {
            try device.lockForConfiguration()
            device.activeFormat = format
            device.unlockForConfiguration()
        }

        let input = try AVCaptureDeviceInput(device: device)

        // Multi-cam requires NoConnections API
        guard avSession.canAddInputWithNoConnections(input) else {
            throw ConfigError.cannotAddInput(deviceType)
        }
        avSession.addInputWithNoConnections(input)

        guard avSession.canAddOutputWithNoConnections(output) else {
            throw ConfigError.cannotAddOutput(deviceType)
        }
        avSession.addOutputWithNoConnections(output)

        // Connect input port → output
        guard let port = input.ports(for: .video, sourceDeviceType: deviceType, sourceDevicePosition: position).first else {
            throw ConfigError.noVideoPort(deviceType)
        }
        let connection = AVCaptureConnection(inputPorts: [port], output: output)
        guard avSession.canAddConnection(connection) else {
            throw ConfigError.cannotAddConnection(deviceType)
        }
        avSession.addConnection(connection)

        // Enable intrinsic matrix delivery
        if connection.isCameraIntrinsicMatrixDeliverySupported {
            connection.isCameraIntrinsicMatrixDeliveryEnabled = true
            print("[MultiCamSession] intrinsic matrix delivery enabled for \(deviceType.rawValue)")
        }

        print("[MultiCamSession] added \(deviceType.rawValue), format: \(device.activeFormat.formatDescription)")
    }

    private func bestFormat(for device: AVCaptureDevice) -> AVCaptureDevice.Format? {
        let formats = device.formats.filter { fmt in
            guard fmt.isMultiCamSupported else { return false }
            let desc = fmt.formatDescription
            let dims = CMVideoFormatDescriptionGetDimensions(desc)
            // Prefer 4:3 aspect ratio
            let ratio = Double(dims.width) / Double(dims.height)
            return abs(ratio - 4.0 / 3.0) < 0.05
        }
        return formats.max {
            let a = CMVideoFormatDescriptionGetDimensions($0.formatDescription)
            let b = CMVideoFormatDescriptionGetDimensions($1.formatDescription)
            return Int(a.width) * Int(a.height) < Int(b.width) * Int(b.height)
        }
    }

    enum ConfigError: LocalizedError {
        case deviceNotFound(AVCaptureDevice.DeviceType)
        case cannotAddInput(AVCaptureDevice.DeviceType)
        case cannotAddOutput(AVCaptureDevice.DeviceType)
        case noVideoPort(AVCaptureDevice.DeviceType)
        case cannotAddConnection(AVCaptureDevice.DeviceType)

        var errorDescription: String? {
            switch self {
            case .deviceNotFound(let t):     return "Camera not found: \(t.rawValue)"
            case .cannotAddInput(let t):     return "Cannot add input: \(t.rawValue)"
            case .cannotAddOutput(let t):    return "Cannot add output: \(t.rawValue)"
            case .noVideoPort(let t):        return "No video port: \(t.rawValue)"
            case .cannotAddConnection(let t): return "Cannot add connection: \(t.rawValue)"
            }
        }
    }
}
