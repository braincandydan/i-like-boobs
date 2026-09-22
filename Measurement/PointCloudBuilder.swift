import Foundation
import simd

struct Point3D {
    var x, y, z: Float
}

final class PointCloudBuilder {
    private(set) var points: [Point3D] = []

    /// Accumulate points from a StereoResult into the running cloud.
    func accumulate(from result: StereoResult) {
        for value in result.points3D {
            var raw = SPPoint3D()
            value.getValue(&raw)
            let p = Point3D(x: raw.x, y: raw.y, z: raw.z)
            // Basic outlier rejection: keep points within 3 m
            guard p.z > 0, p.z < 3.0 else { continue }
            points.append(p)
        }
    }

    /// Subsample to at most `maxPoints` using uniform random selection.
    func subsampled(maxPoints: Int) -> [Point3D] {
        guard points.count > maxPoints else { return points }
        return Array(points.shuffled().prefix(maxPoints))
    }

    func reset() { points.removeAll() }
}
