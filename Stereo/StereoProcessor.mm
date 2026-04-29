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
    // simd_float3x3.columns[c][r]
    cv::Mat out(3, 3, CV_64F);
    for (int r = 0; r < 3; ++r)
        for (int c = 0; c < 3; ++c)
            out.at<double>(r, c) = static_cast<double>(m.columns[c][r]);
    return out;
}

/// Build a 3×4 projection matrix P = K · [R | t].
/// K is a 3×3 camera matrix, R is 3×3, t is a column vector (3×1).
static cv::Mat buildProjectionMatrix(const cv::Mat& K,
                                     const cv::Mat& R,
                                     const cv::Mat& t) {
    cv::Mat Rt;
    cv::hconcat(R, t, Rt);         // [R | t], 3×4
    return K * Rt;                 // 3×4 projection matrix
}

// MARK: – StereoResult

@implementation StereoResult
- (instancetype)init {
    self = [super init];
    if (self) {
        _inlierCount     = 0;
        _usedEdgeFallback = NO;
        _points3D        = @[];
    }
    return self;
}
@end

// MARK: – StereoProcessor

@implementation StereoProcessor {
    NSInteger _inlierThreshold;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _inlierThreshold = 30;
    }
    return self;
}

- (NSInteger)inlierThreshold { return _inlierThreshold; }
- (void)setInlierThreshold:(NSInteger)t { _inlierThreshold = t; }

// MARK: – Main entry point

- (StereoResult *)processFrameA:(CVPixelBufferRef)frameA
                         frameB:(CVPixelBufferRef)frameB
                       edgePtsA:(NSArray<NSValue *> * _Nullable)edgePtsA
                       edgePtsB:(NSArray<NSValue *> * _Nullable)edgePtsB {
    StereoResult *result = [[StereoResult alloc] init];

    // -------------------------------------------------------------------------
    // TODO 1: Wrap pixel data as YUV → greyscale cv::Mat
    //
    // CVPixelBufferLockBaseAddress(frameA, kCVPixelBufferLock_ReadOnly);
    // void *yPlane = CVPixelBufferGetBaseAddressOfPlane(frameA, 0);
    // size_t w     = CVPixelBufferGetWidthOfPlane(frameA, 0);
    // size_t h     = CVPixelBufferGetHeightOfPlane(frameA, 0);
    // size_t stride = CVPixelBufferGetBytesPerRowOfPlane(frameA, 0);
    // cv::Mat grayA(h, w, CV_8UC1, yPlane, stride); // Y-plane is greyscale
    // grayA = grayA.clone();  // copy before unlock
    // CVPixelBufferUnlockBaseAddress(frameA, kCVPixelBufferLock_ReadOnly);
    // (repeat for frameB)
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 2: Undistort using Apple lookup-table format via cv::remap
    //
    // Apple provides a per-pixel inverse distortion map in AVCameraCalibrationData.
    // lensDistortionLookupTable is a table of radial correction offsets indexed by
    // normalised radius. To use with cv::remap:
    //   a) Build map1, map2 (CV_32FC1) at working resolution using the table.
    //   b) cv::remap(grayA, undistA, map1, map2, cv::INTER_LINEAR);
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 3: Compute FOV intersection mask
    //
    // Project the four image corners of each camera into 3-D rays using their
    // intrinsics. Find the angular intersection of all three camera frustums.
    // Create a cv::Mat mask (CV_8UC1) set to 255 inside the intersection, 0 outside.
    // This restricts keypoint detection to the region visible by all cameras.
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 4: Detect ORB keypoints within FOV intersection mask
    //
    // auto orb = cv::ORB::create(2000);
    // std::vector<cv::KeyPoint> kpA, kpB;
    // cv::Mat descA, descB;
    // orb->detectAndCompute(undistA, mask, kpA, descA);
    // orb->detectAndCompute(undistB, mask, kpB, descB);
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 5: BFMatcher with Lowe's ratio test
    //
    // cv::BFMatcher matcher(cv::NORM_HAMMING, false);
    // std::vector<std::vector<cv::DMatch>> knnMatches;
    // matcher.knnMatch(descA, descB, knnMatches, 2);
    // std::vector<cv::DMatch> goodMatches;
    // for (auto &m : knnMatches)
    //     if (m.size() == 2 && m[0].distance < 0.75f * m[1].distance)
    //         goodMatches.push_back(m[0]);
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 6: findFundamentalMat with RANSAC → inlier mask
    //
    // if (goodMatches.size() >= 8) {
    //     std::vector<cv::Point2f> ptsA, ptsB;
    //     for (auto &m : goodMatches) {
    //         ptsA.push_back(kpA[m.queryIdx].pt);
    //         ptsB.push_back(kpB[m.trainIdx].pt);
    //     }
    //     cv::Mat inlierMask;
    //     cv::findFundamentalMat(ptsA, ptsB, cv::FM_RANSAC, 1.0, 0.999, inlierMask);
    //     // count inliers
    // }
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 7: Low-texture fallback — use rectangle edge points if inliers < threshold
    //
    // if (inlierCount < _inlierThreshold && edgePtsA.count > 0 && edgePtsB.count > 0) {
    //     result.usedEdgeFallback = YES;
    //     // Treat edgePtsA/edgePtsB as pre-matched point pairs (same index = same edge).
    //     // Convert NSValue CGPoint → cv::Point2f and re-run findFundamentalMat + triangulatePoints.
    // }
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // TODO 8: triangulatePoints
    //
    // Build intrinsic matrices from self.intrinsicsA / self.intrinsicsB (simd_float4: fx,fy,cx,cy).
    // Build rotation / translation from self.rotation and self.baseline.
    // cv::Mat PA = buildProjectionMatrix(KA, cv::Mat::eye(3,3,CV_64F), cv::Mat::zeros(3,1,CV_64F));
    // cv::Mat PB = buildProjectionMatrix(KB, R, t);
    // cv::Mat pts4D;
    // cv::triangulatePoints(PA, PB, ptsA_inliers, ptsB_inliers, pts4D);
    // Convert homogeneous → Euclidean, filter points with z > 0 and z < 3.0 m.
    // Pack into result.points3D as NSValue-wrapped SPPoint3D.
    // -------------------------------------------------------------------------

    NSLog(@"[StereoProcessor] stub — returning empty result (implement TODOs above)");
    return result;
}

@end
