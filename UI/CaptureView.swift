import SwiftUI
import AVFoundation
import Vision

// MARK: – View

struct CaptureView: View {
    @ObservedObject var session: MultiCamSession
    @StateObject private var vm = CaptureViewModel()

    var body: some View {
        ZStack {
            CameraPreviewView(session: session)
                .ignoresSafeArea()

            if let dims = vm.dimensions {
                DimensionOverlayView(dimensions: dims)
            }

            statusBadge

            controls
        }
        .onAppear {
            session.start()
            vm.setup(session: session)
        }
        .onDisappear {
            session.stop()
        }
        .navigationBarHidden(true)
    }

    // MARK: – Sub-views

    @ViewBuilder
    private var statusBadge: some View {
        if let msg = vm.statusMessage {
            Text(msg)
                .font(.caption)
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.black.opacity(0.5))
                .clipShape(Capsule())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(.top, 56)
                .padding(.trailing, 16)
        }
    }

    private var controls: some View {
        VStack {
            Spacer()
            HStack(spacing: 32) {
                NavigationLink(destination: CalibrationView()) {
                    Label("Calibrate", systemImage: "ruler")
                        .padding(12)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Shutter: freeze the current cloud for inspection
                Button { vm.freeze() } label: {
                    Circle()
                        .fill(vm.isFrozen ? Color.yellow : Color.white)
                        .frame(width: 72, height: 72)
                        .overlay(Circle().stroke(Color.gray, lineWidth: 2))
                }

                Button { vm.reset() } label: {
                    Label("Reset", systemImage: "arrow.counterclockwise")
                        .padding(12)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.bottom, 40)
        }
    }
}

// MARK: – ViewModel

final class CaptureViewModel: ObservableObject {
    @Published private(set) var dimensions:    BoxDimensions?
    @Published private(set) var statusMessage: String?
    @Published private(set) var isFrozen      = false

    private var synchroniser: FrameSynchroniser?
    private let calibration  = CameraCalibration()
    private let boxDetector  = BoxDetector()
    private let cloudBuilder = PointCloudBuilder()
    private let boxFitter    = BoundingBoxFitter()

    private let processorUW   = StereoProcessor()
    private let processorTele = StereoProcessor()

    private static let workingSize = CGSize(width: 1024, height: 768)

    // Process every 6th bundle (~5 fps at 30 fps input) to stay real-time on device.
    private var frameCount = 0
    private let processInterval = 6

    // MARK: – Setup

    func setup(session: MultiCamSession) {
        guard synchroniser == nil else { return }
        let sync = FrameSynchroniser(session: session)
        synchroniser = sync
        sync.onFrame = { [weak self] bundle in
            self?.handleBundle(bundle)
        }
    }

    // MARK: – Controls

    func freeze() {
        isFrozen.toggle()
        let msg = isFrozen ? "Frozen — tap to resume" : nil
        DispatchQueue.main.async { self.statusMessage = msg }
    }

    func reset() {
        isFrozen = false
        cloudBuilder.reset()
        DispatchQueue.main.async {
            self.dimensions    = nil
            self.statusMessage = nil
        }
    }

    // MARK: – Per-bundle processing (on FrameSynchroniser's serial background queue)

    private func handleBundle(_ bundle: SynchronisedFrameBundle) {
        // Always update intrinsics — cheap and required before first measurement
        calibration.update(sampleBuffer: bundle.wide,      role: .wide)
        calibration.update(sampleBuffer: bundle.ultrawide, role: .ultrawide)
        calibration.update(sampleBuffer: bundle.telephoto, role: .telephoto)

        guard !isFrozen else { return }

        frameCount += 1
        guard frameCount % processInterval == 0 else { return }

        guard
            let wideI = calibration.wideIntrinsics,
            let uwI   = calibration.ultrawideIntrinsics,
            let teleI = calibration.telephotoIntrinsics
        else {
            updateStatus("Waiting for camera intrinsics…")
            return
        }

        let ws = CaptureViewModel.workingSize
        let wideScaled = wideI.scaled(to: ws)
        let uwScaled   = uwI.scaled(to: ws)
        let teleScaled = teleI.scaled(to: ws)

        // Configure wide↔ultrawide processor
        let uwExt = calibration.wideToUltrawideExtrinsics
        processorUW.intrinsicsA = simd_float4(wideScaled.fx, wideScaled.fy, wideScaled.cx, wideScaled.cy)
        processorUW.intrinsicsB = simd_float4(uwScaled.fx,   uwScaled.fy,   uwScaled.cx,   uwScaled.cy)
        processorUW.baseline    = uwExt.baseline
        processorUW.rotation    = uwExt.rotation

        // Configure wide↔telephoto processor
        let teleExt = calibration.wideToTelephotoExtrinsics
        processorTele.intrinsicsA = simd_float4(wideScaled.fx,   wideScaled.fy,   wideScaled.cx,   wideScaled.cy)
        processorTele.intrinsicsB = simd_float4(teleScaled.fx,   teleScaled.fy,   teleScaled.cx,   teleScaled.cy)
        processorTele.baseline    = teleExt.baseline
        processorTele.rotation    = teleExt.rotation

        guard
            let widePB = CMSampleBufferGetImageBuffer(bundle.wide),
            let uwPB   = CMSampleBufferGetImageBuffer(bundle.ultrawide),
            let telePB = CMSampleBufferGetImageBuffer(bundle.telephoto)
        else { return }

        // Run synchronous box detection on wide and partner cameras for edge fallback
        let wideSize  = CGSize(width: CVPixelBufferGetWidth(widePB),
                               height: CVPixelBufferGetHeight(widePB))
        let uwSize    = CGSize(width: CVPixelBufferGetWidth(uwPB),
                               height: CVPixelBufferGetHeight(uwPB))
        let teleSize  = CGSize(width: CVPixelBufferGetWidth(telePB),
                               height: CVPixelBufferGetHeight(telePB))

        let wideBoxes = boxDetector.detectSync(in: widePB)
        let uwBoxes   = boxDetector.detectSync(in: uwPB)
        let teleBoxes = boxDetector.detectSync(in: telePB)

        let wideEdgePts = boxDetector.edgePoints(from: wideBoxes, in: wideSize)
        let uwEdgePts   = boxDetector.edgePoints(from: uwBoxes,   in: uwSize)
        let teleEdgePts = boxDetector.edgePoints(from: teleBoxes,  in: teleSize)

        // Wrap CGPoint arrays as NSValue for ObjC bridge
        func wrap(_ pts: [CGPoint]) -> [NSValue] { pts.map { NSValue(cgPoint: $0) } }

        let wideEdgeNS = wrap(wideEdgePts)
        let uwEdgeNS   = wrap(uwEdgePts)
        let teleEdgeNS = wrap(teleEdgePts)

        // Run stereo pipelines
        let resultUW   = processorUW.processFrameA(widePB, frameB: uwPB,
                                                   edgePtsA: wideEdgeNS.isEmpty ? nil : wideEdgeNS,
                                                   edgePtsB: uwEdgeNS.isEmpty   ? nil : uwEdgeNS)
        let resultTele = processorTele.processFrameA(widePB, frameB: telePB,
                                                     edgePtsA: wideEdgeNS.isEmpty  ? nil : wideEdgeNS,
                                                     edgePtsB: teleEdgeNS.isEmpty  ? nil : teleEdgeNS)

        // Accumulate
        cloudBuilder.accumulate(from: resultUW)
        cloudBuilder.accumulate(from: resultTele)

        let pts  = cloudBuilder.subsampled(maxPoints: 5000)
        let status = String(format: "pts=%d  UW=%d  Tele=%d%@%@",
                            pts.count,
                            resultUW.inlierCount,
                            resultTele.inlierCount,
                            resultUW.usedEdgeFallback   ? " ✦UW"   : "",
                            resultTele.usedEdgeFallback ? " ✦Tele" : "")

        if let dims = boxFitter.fit(points: pts) {
            DispatchQueue.main.async { [weak self] in
                self?.dimensions    = dims
                self?.statusMessage = status
            }
        } else {
            updateStatus(status)
        }
    }

    private func updateStatus(_ msg: String) {
        DispatchQueue.main.async { self.statusMessage = msg }
    }
}
