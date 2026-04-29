import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var session = MultiCamSession()

    var body: some View {
        Group {
            if AVCaptureMultiCamSession.isMultiCamSupported {
                CaptureView(session: session)
            } else {
                UnsupportedDeviceView()
            }
        }
    }
}

private struct UnsupportedDeviceView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "camera.badge.exclamationmark")
                .font(.system(size: 64))
                .foregroundColor(.secondary)
            Text("Multi-Camera Not Supported")
                .font(.title2)
                .fontWeight(.semibold)
            Text("StereoMeasure requires an iPhone Pro with simultaneous multi-camera capture (iPhone 11 Pro or later).")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.horizontal)
        }
        .padding()
    }
}
