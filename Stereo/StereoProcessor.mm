// StereoProcessor.mm — OpenCV stereo pipeline (C++17)
// All OpenCV calls are isolated to this file.

#import "StereoProcessor.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"
#import <opencv2/opencv.hpp>
#pragma clang diagnostic pop

#import <simd/simd.h>

// MARK: – SIMD ↔ cv::Mat helpers

/// Convert a simd 3×3 column-major matrix to a 3×3 row-major cv::Mat (CV_64F).
static cv::Mat simdToCvMat3x3(simd_float3x3 m) {
    cv::Mat out(3, 3, CV_64F);
    for (int r = 0; r < 3; ++r)
        for (int c = 0; c < 3; ++c)
            out.at<double>(r, c) = static_cast<double>(m.columns[c][r]);
    return out;
}

/// Build a 3×4 projection matrix P = K · [R | t].
static cv::Mat buildProjectionMatrix(const cv::Mat& K,
                                     const cv::Mat& R,
                                     const cv::Mat& t) {
    cv::Mat Rt;
    cv::hconcat(R, t, Rt);
    return K * Rt;
}

// MARK: – Frame helpers

/// Extract and clone the Y (luminance) plane from a biplanar YUV pixel buffer.
static cv::Mat yPlaneFromPixelBuffer(CVPixelBufferRef buf) {
    CVPixelBufferLockBaseAddress(buf, kCVPixelBufferLock_ReadOnly);
    void   *base   = CVPixelBufferGetBaseAddressOfPlane(buf, 0);
    size_t  w      = CVPixelBufferGetWidthOfPlane(buf, 0);
    size_t  h      = CVPixelBufferGetHeightOfPlane(buf, 0);
    size_t  stride = CVPixelBufferGetBytesPerRowOfPlane(buf, 0);
    cv::Mat gray(static_cast<int>(h), static_cast<int>(w), CV_8UC1, base, stride);
    cv::Mat result = gray.clone();   // copy before unlocking
    CVPixelBufferUnlockBaseAddress(buf, kCVPixelBufferLock_ReadOnly);
    return result;
}

/// Resize src to ~targetArea pixels, returning the x/y scale factors applied.
static cv::Mat downsampleToArea(const cv::Mat& src,
                                double targetArea,
                                double& sx, double& sy) {
    double area = static_cast<double>(src.cols) * src.rows;
    if (area <= targetArea) { sx = 1.0; sy = 1.0; return src; }
    double s = std::sqrt(targetArea / area);
    cv::Mat dst;
    cv::resize(src, dst, cv::Size(), s, s, cv::INTER_AREA);
    sx = s; sy = s;
    return dst;
}

// MARK: – FOV intersection mask

/// Returns a binary mask (CV_8UC1, 255 = valid) in camera-A image space covering
/// only pixels whose ray directions also project inside camera-B's image frustum.
/// Uses rotation-only ray projection (depth-independent; good for objects > 30 cm).
static cv::Mat fovIntersectionMask(cv::Size sizeA, const cv::Mat& KA,
                                    cv::Size sizeB, const cv::Mat& KB,
                                    const cv::Mat& R) {
    const double fxA = KA.at<double>(0,0), fyA = KA.at<double>(1,1);
    const double cxA = KA.at<double>(0,2), cyA = KA.at<double>(1,2);
    const double fxB = KB.at<double>(0,0), fyB = KB.at<double>(1,1);
    const double cxB = KB.at<double>(0,2), cyB = KB.at<double>(1,2);
    const int WA = sizeA.width,  HA = sizeA.height;
    const int WB = sizeB.width,  HB = sizeB.height;

    // Coarse grid (8 px step) — resize and fill after
    const int step = 8;
    const int cols = (WA + step - 1) / step;
    const int rows = (HA + step - 1) / step;
    cv::Mat small(rows, cols, CV_8UC1, cv::Scalar(0));

    for (int gy = 0; gy < rows; ++gy) {
        for (int gx = 0; gx < cols; ++gx) {
            double Xw = (gx * step - cxA) / fxA;
            double Yw = (gy * step - cyA) / fyA;
            // Rotate unit ray into camera-B frame
            double Xb = R.at<double>(0,0)*Xw + R.at<double>(0,1)*Yw + R.at<double>(0,2);
            double Yb = R.at<double>(1,0)*Xw + R.at<double>(1,1)*Yw + R.at<double>(1,2);
            double Zb = R.at<double>(2,0)*Xw + R.at<double>(2,1)*Yw + R.at<double>(2,2);
            if (Zb <= 0.0) continue;
            double uB = fxB * (Xb / Zb) + cxB;
            double vB = fyB * (Yb / Zb) + cyB;
            if (uB >= 0 && uB < WB && vB >= 0 && vB < HB)
                small.at<uint8_t>(gy, gx) = 255;
        }
    }

    cv::Mat mask;
    cv::resize(small, mask, sizeA, 0, 0, cv::INTER_NEAREST);
    // Pull away from the boundary so keypoints near the edge are rejected
    cv::erode(mask, mask, cv::getStructuringElement(cv::MORPH_RECT, cv::Size(9, 9)));
    return mask;
}

// MARK: – RANSAC fundamental matrix helper

/// Runs findFundamentalMat (RANSAC) and returns the inlier count.
/// ptsA / ptsB must have the same length; inlierMask is filled on return.
static int ransacFundamental(const std::vector<cv::Point2f>& ptsA,
                              const std::vector<cv::Point2f>& ptsB,
                              std::vector<uchar>& inlierMask) {
    if (ptsA.size() < 8) { inlierMask.clear(); return 0; }
    inlierMask.clear();
    cv::findFundamentalMat(ptsA, ptsB, cv::FM_RANSAC, 1.5, 0.999, inlierMask);
    int n = 0;
    for (auto v : inlierMask) n += (v ? 1 : 0);
    return n;
}

// MARK: – StereoResult

@implementation StereoResult
- (instancetype)init {
    self = [super init];
    if (self) { _inlierCount = 0; _usedEdgeFallback = NO; _points3D = @[]; }
    return self;
}
@end

// MARK: – StereoProcessor

@implementation StereoProcessor {
    NSInteger _inlierThreshold;
}

- (instancetype)init {
    self = [super init];
    if (self) { _inlierThreshold = 30; }
    return self;
}

- (NSInteger)inlierThreshold { return _inlierThreshold; }
- (void)setInlierThreshold:(NSInteger)t { _inlierThreshold = t; }

- (StereoResult *)processFrameA:(CVPixelBufferRef)frameA
                         frameB:(CVPixelBufferRef)frameB
                       edgePtsA:(NSArray<NSValue *> * _Nullable)edgePtsA
                       edgePtsB:(NSArray<NSValue *> * _Nullable)edgePtsB {
    StereoResult *result = [[StereoResult alloc] init];

    // ── Step 1: Y-plane → greyscale cv::Mat ──────────────────────────────────
    cv::Mat rawA = yPlaneFromPixelBuffer(frameA);
    cv::Mat rawB = yPlaneFromPixelBuffer(frameB);
    if (rawA.empty() || rawB.empty()) return result;

    // Downsample to ~1MP (1024×768 = 786 432 px) for feature matching speed.
    // Caller must pre-scale intrinsics to match this resolution via scaled(to:).
    const double kTargetArea = 1024.0 * 768.0;
    double sxA, syA, sxB, syB;
    cv::Mat grayA = downsampleToArea(rawA, kTargetArea, sxA, syA);
    cv::Mat grayB = downsampleToArea(rawB, kTargetArea, sxB, syB);

    // ── Step 2: Camera matrices ───────────────────────────────────────────────
    // simd_float4 packing: (fx, fy, cx, cy)
    cv::Mat KA = (cv::Mat_<double>(3,3) <<
        (double)self.intrinsicsA.x, 0,                       (double)self.intrinsicsA.z,
        0,                          (double)self.intrinsicsA.y, (double)self.intrinsicsA.w,
        0,                          0,                          1);
    cv::Mat KB = (cv::Mat_<double>(3,3) <<
        (double)self.intrinsicsB.x, 0,                       (double)self.intrinsicsB.z,
        0,                          (double)self.intrinsicsB.y, (double)self.intrinsicsB.w,
        0,                          0,                          1);
    cv::Mat R = simdToCvMat3x3(self.rotation);
    cv::Mat t = (cv::Mat_<double>(3,1) <<
        (double)self.baseline.x, (double)self.baseline.y, (double)self.baseline.z);

    // Lens undistortion via cv::remap is intentionally deferred: Apple's wide
    // camera has <1% radial distortion at this FOV, and the lookup table
    // (AVCameraCalibrationData.lensDistortionLookupTable) is not yet threaded
    // through this interface. Add -setLensTableA:tableB: + build map1/map2 here
    // when sub-pixel accuracy at the image edges becomes a priority.

    // ── Step 3: FOV intersection mask ────────────────────────────────────────
    cv::Mat mask = fovIntersectionMask(grayA.size(), KA, grayB.size(), KB, R);

    // ── Step 4: ORB keypoints within the FOV-intersection mask ───────────────
    auto orb = cv::ORB::create(2000);
    std::vector<cv::KeyPoint> kpA, kpB;
    cv::Mat descA, descB;
    orb->detectAndCompute(grayA, mask, kpA, descA);
    orb->detectAndCompute(grayB, cv::Mat(), kpB, descB);

    // ── Step 5: BFMatcher + Lowe's ratio test ────────────────────────────────
    std::vector<cv::Point2f> ptsA, ptsB;
    if (!descA.empty() && !descB.empty() && kpA.size() >= 8 && kpB.size() >= 8) {
        cv::BFMatcher matcher(cv::NORM_HAMMING, /*crossCheck=*/false);
        std::vector<std::vector<cv::DMatch>> knn;
        matcher.knnMatch(descA, descB, knn, 2);
        for (auto& m : knn) {
            if (m.size() == 2 && m[0].distance < 0.75f * m[1].distance) {
                ptsA.push_back(kpA[m[0].queryIdx].pt);
                ptsB.push_back(kpB[m[0].trainIdx].pt);
            }
        }
    }

    // ── Step 6: findFundamentalMat (RANSAC) ──────────────────────────────────
    std::vector<uchar> inlierMask;
    int inlierCount = ransacFundamental(ptsA, ptsB, inlierMask);

    // ── Step 7: Low-texture fallback — rectangle edge points ─────────────────
    // edgePtsA/edgePtsB are index-matched: corner i in A ↔ corner i in B,
    // produced by running VNDetectRectanglesRequest on both frames independently.
    bool usedFallback = false;
    if (inlierCount < _inlierThreshold &&
        edgePtsA.count >= 8 && edgePtsB.count >= 8) {
        usedFallback = true;
        ptsA.clear(); ptsB.clear();
        NSUInteger n = MIN(edgePtsA.count, edgePtsB.count);
        for (NSUInteger i = 0; i < n; i++) {
            CGPoint a = [edgePtsA[i] CGPointValue];
            CGPoint b = [edgePtsB[i] CGPointValue];
            // Edge points are in full-resolution pixel coords; scale to working res
            ptsA.push_back(cv::Point2f((float)(a.x * sxA), (float)(a.y * syA)));
            ptsB.push_back(cv::Point2f((float)(b.x * sxB), (float)(b.y * syB)));
        }
        inlierCount = ransacFundamental(ptsA, ptsB, inlierMask);
    }

    result.inlierCount     = inlierCount;
    result.usedEdgeFallback = usedFallback;
    NSLog(@"[StereoProcessor] inliers=%d fallback=%d kpA=%zu kpB=%zu matches=%zu",
          inlierCount, (int)usedFallback, kpA.size(), kpB.size(), ptsA.size());

    if (inlierCount < 4) return result;

    // Filter to inlier pairs
    std::vector<cv::Point2f> inPtsA, inPtsB;
    for (size_t i = 0; i < inlierMask.size() && i < ptsA.size(); i++) {
        if (inlierMask[i]) { inPtsA.push_back(ptsA[i]); inPtsB.push_back(ptsB[i]); }
    }

    // ── Step 8: triangulatePoints ─────────────────────────────────────────────
    // Camera A is at origin; camera B is displaced by (R, t).
    cv::Mat PA = buildProjectionMatrix(KA, cv::Mat::eye(3,3,CV_64F), cv::Mat::zeros(3,1,CV_64F));
    cv::Mat PB = buildProjectionMatrix(KB, R, t);
    cv::Mat pts4D;
    cv::triangulatePoints(PA, PB, inPtsA, inPtsB, pts4D);

    NSMutableArray<NSValue *> *points = [NSMutableArray array];
    for (int i = 0; i < pts4D.cols; i++) {
        float w = pts4D.at<float>(3, i);
        if (fabsf(w) < 1e-6f) continue;
        float x = pts4D.at<float>(0, i) / w;
        float y = pts4D.at<float>(1, i) / w;
        float z = pts4D.at<float>(2, i) / w;
        if (z <= 0.0f || z > 3.0f) continue;   // keep 0–3 m depth range
        SPPoint3D p = {x, y, z};
        [points addObject:[NSValue valueWithBytes:&p objCType:@encode(SPPoint3D)]];
    }
    result.points3D = points;
    return result;
}

@end
