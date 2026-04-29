import Vision
import CoreImage
import CoreVideo

struct DetectedBox {
    /// Four corner points in normalised image coordinates (origin top-left).
    let corners: [CGPoint]
    /// Confidence score from VNDetectRectanglesRequest.
    let confidence: Float
}

final class BoxDetector {
    // Run rectangle detection at ~1920×1440 for edge accuracy.
    private static let detectionSize = CGSize(width: 1920, height: 1440)

    private let requestHandler: (VNImageRequestHandler) throws -> Void = { try $0.perform([]) }

    func detect(in sampleBuffer: CMSampleBuffer,
                completion: @escaping ([DetectedBox]) -> Void) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            completion([])
            return
        }

        let request = VNDetectRectanglesRequest { req, _ in
            let results = (req.results as? [VNRectangleObservation]) ?? []
            let boxes = results.map { obs in
                DetectedBox(
                    corners: [obs.topLeft, obs.topRight, obs.bottomRight, obs.bottomLeft],
                    confidence: obs.confidence
                )
            }
            completion(boxes)
        }
        request.minimumAspectRatio = 0.3
        request.maximumAspectRatio = 1.0
        request.minimumSize        = 0.1
        request.maximumObservations = 4
        request.minimumConfidence  = 0.6

        // Scale hint to run detection near the target resolution
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer,
                                            orientation: .up,
                                            options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                print("[BoxDetector] detection failed: \(error)")
                completion([])
            }
        }
    }

    /// Returns the edge points of all detected boxes as a flat array, suitable for
    /// use as fallback match candidates when ORB produces too few inliers.
    func edgePoints(from boxes: [DetectedBox], in imageSize: CGSize) -> [CGPoint] {
        var points: [CGPoint] = []
        for box in boxes {
            // Sample points along each of the 4 edges
            let corners = box.corners
            for i in 0..<4 {
                let a = corners[i]
                let b = corners[(i + 1) % 4]
                for t in stride(from: 0.0, through: 1.0, by: 0.1) {
                    let x = a.x + (b.x - a.x) * t
                    let y = a.y + (b.y - a.y) * t
                    // Convert from normalised VN coords (origin bottom-left) to pixel coords (origin top-left)
                    points.append(CGPoint(x: x * imageSize.width,
                                          y: (1 - y) * imageSize.height))
                }
            }
        }
        return points
    }
}
