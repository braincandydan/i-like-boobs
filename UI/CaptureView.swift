import SwiftUI
import AVFoundation

struct CaptureView: View {
    @ObservedObject var session: MultiCamSession

    @StateObject private var vm = CaptureViewModel()

    var body: some View {
        ZStack {
            // Live preview (wide camera)
            CameraPreviewView(session: session)
                .ignoresSafeArea()

            // Box dimension overlay
            if let dims = vm.dimensions {
                DimensionOverlayView(dimensions: dims)
            }

            // Controls
            VStack {
                Spacer()
                HStack(spacing: 32) {
                    NavigationLink(destination: CalibrationView()) {
                        Label("Calibrate", systemImage: "ruler")
                            .padding(12)
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button {
                        vm.capture(session: session)
                    } label: {
                        Circle()
                            .fill(.white)
                            .frame(width: 72, height: 72)
                            .overlay(Circle().stroke(.gray, lineWidth: 2))
                    }

                    Button {
                        vm.reset()
                    } label: {
                        Label("Reset", systemImage: "arrow.counterclockwise")
                            .padding(12)
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .onAppear { session.start() }
        .onDisappear { session.stop() }
        .navigationBarHidden(true)
    }
}

@MainActor
final class CaptureViewModel: ObservableObject {
    @Published var dimensions: BoxDimensions?

    private let synchroniser: FrameSynchroniser? = nil
    private let calibration = CameraCalibration()
    private let boxDetector = BoxDetector()
    private let cloudBuilder = PointCloudBuilder()
    private let boxFitter    = BoundingBoxFitter()

    func capture(session: MultiCamSession) {
        // TODO: trigger a measurement cycle
        // 1. Grab the next SynchronisedFrameBundle
        // 2. Run BoxDetector on wide frame
        // 3. Run StereoProcessor for wide↔ultrawide and wide↔telephoto
        // 4. Accumulate into PointCloudBuilder
        // 5. Fit bounding box and update dimensions
        print("[CaptureViewModel] capture triggered — pipeline not yet wired")
    }

    func reset() {
        cloudBuilder.reset()
        dimensions = nil
    }
}
