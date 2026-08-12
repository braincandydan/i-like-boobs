import SwiftUI
import AVFoundation
import UIKit

/// SwiftUI wrapper around AVCaptureVideoPreviewLayer (wide camera).
struct CameraPreviewView: UIViewRepresentable {
    let session: MultiCamSession

    func makeUIView(context: Context) -> PreviewUIView {
        let view = PreviewUIView()
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ uiView: PreviewUIView, context: Context) {
        uiView.attach(previewLayer: session.widePreviewLayer)
    }
}

final class PreviewUIView: UIView {
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }

    func attach(previewLayer newLayer: AVCaptureVideoPreviewLayer?) {
        guard let newLayer, newLayer !== previewLayer else { return }
        previewLayer?.removeFromSuperlayer()
        previewLayer = newLayer
        newLayer.frame = bounds
        layer.insertSublayer(newLayer, at: 0)
    }
}
