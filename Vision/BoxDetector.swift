import Vision
import CoreImage
import CoreVideo

struct DetectedBox {
    /// Four corner points in normalised image coordinates (VN convention: origin bottom-left).
    let corners: [CGPoint]
    let confidence: Float
}

final class BoxDetector {
    private func makeRequest(completion: @escaping ([DetectedBox]) -> Void) -> VNDetectRectanglesRequest {
        let req = VNDetectRectanglesRequest { r, _ in
            let obs = (r.results as? [VNRectangleObservation]) ?? []
            completion(obs.map { o in
                DetectedBox(corners: [o.topLeft, o.topRight, o.bottomRight, o.bottomLeft],
                            confidence: o.confidence)
            })
        }
        req.minimumAspectRatio  = 0.3
        req.maximumAspectRatio  = 1.0
        req.minimumSize         = 0.1
        req.maximumObservations = 4
        req.minimumConfidence   = 0.6
        return req
    }

    /// Synchronous — blocks the calling thread. Safe to call from a background queue.
    /// VNImageRequestHandler.perform is itself synchronous.
    func detectSync(in pixelBuffer: CVPixelBuffer) -> [DetectedBox] {
        var result: [DetectedBox] = []
        let req = makeRequest { result = $0 }
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        try? handler.perform([req])
        return result
    }

    /// Async variant — dispatches onto a global queue and calls completion when done.
    func detect(in sampleBuffer: CMSampleBuffer,
                completion: @escaping ([DetectedBox]) -> Void) {
        guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer) else { completion([]); return }
        DispatchQueue.global(qos: .userInitiated).async {
            completion(self.detectSync(in: pb))
        }
    }

    /// Converts detected box corners to pixel-space edge points (origin top-left).
    /// Samples 11 points per edge (t = 0.0 … 1.0 in steps of 0.1).
    func edgePoints(from boxes: [DetectedBox], in imageSize: CGSize) -> [CGPoint] {
        var pts: [CGPoint] = []
        for box in boxes {
            let c = box.corners
            for i in 0..<4 {
                let a = c[i], b = c[(i + 1) % 4]
                for step in 0...10 {
                    let t = Double(step) / 10.0
                    // VN coords: y=0 at bottom → flip to top-left origin
                    pts.append(CGPoint(
                        x: (a.x + (b.x - a.x) * t) * imageSize.width,
                        y: (1 - (a.y + (b.y - a.y) * t)) * imageSize.height
                    ))
                }
            }
        }
        return pts
    }
}
