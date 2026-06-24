#pragma once

#import <Foundation/Foundation.h>
#import <CoreVideo/CoreVideo.h>
#import <simd/simd.h>

NS_ASSUME_NONNULL_BEGIN

/// Triangulated 3-D point (metres, camera-A coordinate frame).
typedef struct {
    float x, y, z;
} SPPoint3D;

/// Result from processing one stereo pair.
@interface StereoResult : NSObject
@property (nonatomic, assign) NSInteger inlierCount;
@property (nonatomic, assign) BOOL usedEdgeFallback;
/// Points in camera-A frame, valid only when inlierCount > 0.
@property (nonatomic, strong) NSArray<NSValue *> *points3D; // NSValue wrapping SPPoint3D
@end

/// Thin ObjC wrapper around the C++17 stereo pipeline.
@interface StereoProcessor : NSObject

/// Camera-A intrinsics (fx, fy, cx, cy) at the working resolution.
@property (nonatomic, assign) simd_float4 intrinsicsA;
/// Camera-B intrinsics (fx, fy, cx, cy) at the working resolution.
@property (nonatomic, assign) simd_float4 intrinsicsB;
/// Baseline vector from camera A to B, metres.
@property (nonatomic, assign) simd_float3 baseline;
/// Rotation matrix (3×3, column-major) from camera A to B.
@property (nonatomic, assign) simd_float3x3 rotation;

/// Minimum inlier count before falling back to rectangle-edge matching.
@property (nonatomic, assign) NSInteger inlierThreshold; // default 30

/// Process a stereo pair and return triangulated 3-D points.
/// @param frameA  CVPixelBuffer from camera A (wide).
/// @param frameB  CVPixelBuffer from camera B (ultrawide or telephoto).
/// @param edgePtsA  Fallback edge points in image-A pixel coords (may be nil).
/// @param edgePtsB  Fallback edge points in image-B pixel coords (may be nil).
- (StereoResult *)processFrameA:(CVPixelBufferRef)frameA
                         frameB:(CVPixelBufferRef)frameB
                       edgePtsA:(nullable NSArray<NSValue *> *)edgePtsA
                       edgePtsB:(nullable NSArray<NSValue *> *)edgePtsB;

@end

NS_ASSUME_NONNULL_END
