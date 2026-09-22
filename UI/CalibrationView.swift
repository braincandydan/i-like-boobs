import SwiftUI

/// Optional checkerboard stereoCalibrate UI.
/// Launch: only accessible from CaptureView settings — not shown at first launch.
struct CalibrationView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var isCalibrating = false
    @State private var status: String = "Point all three cameras at a 9×6 checkerboard (25 mm squares)."

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Text(status)
                    .multilineTextAlignment(.center)
                    .padding()

                if isCalibrating {
                    ProgressView("Calibrating…")
                } else {
                    Button("Start Calibration") {
                        runCalibration()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Use Hardcoded Baselines") {
                        dismiss()
                    }
                    .foregroundColor(.secondary)
                }

                // TODO: live viewfinder showing checkerboard detection overlay
                Spacer()
                Text("Hardcoded defaults — Wide↔UW: 11 mm, Wide↔Tele: 17 mm")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.bottom)
            }
            .navigationTitle("Stereo Calibration")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func runCalibration() {
        isCalibrating = true
        status = "Capture in progress…"
        // TODO: collect ~20 synchronised stereo frame bundles of the checkerboard,
        // run cv::findChessboardCorners + cv::stereoCalibrate in StereoProcessor,
        // persist results via CameraCalibration.persist(wideToUltrawide:) / persist(wideToTelephoto:).
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            status = "Calibration not yet implemented — using hardcoded baselines."
            isCalibrating = false
        }
    }
}
