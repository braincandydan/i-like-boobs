import Foundation
import simd
import Accelerate

struct BoxDimensions {
    /// Length, width, height in metres.
    var length: Float
    var width:  Float
    var height: Float

    /// Formatted as "L × W × H cm" with ±0.5 cm resolution.
    var formatted: String {
        String(format: "%.1f × %.1f × %.1f cm",
               length * 100, width * 100, height * 100)
    }
}

final class BoundingBoxFitter {
    /// Fit an axis-aligned bounding box to the given point cloud.
    /// Returns nil if there are fewer than 10 points.
    func fit(points: [Point3D]) -> BoxDimensions? {
        guard points.count >= 10 else { return nil }

        var minX = Float.greatestFiniteMagnitude
        var minY = Float.greatestFiniteMagnitude
        var minZ = Float.greatestFiniteMagnitude
        var maxX = -Float.greatestFiniteMagnitude
        var maxY = -Float.greatestFiniteMagnitude
        var maxZ = -Float.greatestFiniteMagnitude

        for p in points {
            minX = min(minX, p.x); maxX = max(maxX, p.x)
            minY = min(minY, p.y); maxY = max(maxY, p.y)
            minZ = min(minZ, p.z); maxZ = max(maxZ, p.z)
        }

        // Map AABB extents to L×W×H (largest→length, middle→width, smallest→height)
        var extents = [maxX - minX, maxY - minY, maxZ - minZ].sorted(by: >)
        return BoxDimensions(length: extents[0], width: extents[1], height: extents[2])
    }
}
