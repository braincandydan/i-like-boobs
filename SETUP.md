# StereoMeasure — Setup Guide

## Requirements

| Item | Version |
|------|---------|
| Xcode | 15.0+ |
| iOS Deployment Target | 16.0 |
| Device | iPhone 11 Pro or later (AVCaptureMultiCamSession required) |
| CocoaPods | 1.14+ |

---

## 1. Install dependencies

```bash
cd StereoMeasure
pod install
open Stereo.xcworkspace   # always use .xcworkspace, not .xcodeproj
```

---

## 2. Required Xcode Build Settings

Open **Stereo** target → Build Settings and set:

| Setting | Value |
|---------|-------|
| iOS Deployment Target | `16.0` |
| Swift Objective-C Bridging Header | `Stereo/Stereo-Bridging-Header.h` |
| C++ Language Dialect | `C++17 [-std=c++17]` |
| C++ Standard Library | `libc++ (LLVM C++ standard library with C++11 support)` |
| Enable Bitcode | `No` |
| Other C++ Flags | `-std=c++17` |

> **Note:** OpenCV 4.9 requires C++17 and does not support Bitcode. Both must be
> set on the main target **and** propagated to the Pods target via the
> `post_install` hook already present in `Podfile`.

---

## 3. Signing

Set **Team** and **Bundle Identifier** under Signing & Capabilities. The app
requires the **Camera** capability and the camera usage description is already in
`Resources/Info.plist`.

---

## 4. Project file structure

```
Stereo/
├── Podfile
├── Stereo-Bridging-Header.h        ← Swift ↔ ObjC/C++ bridge
├── App/
│   ├── StereoApp.swift             ← @main entry point
│   └── ContentView.swift           ← multi-cam guard + root view
├── Camera/
│   ├── MultiCamSession.swift       ← AVCaptureMultiCamSession wrapper
│   ├── FrameSynchroniser.swift     ← AVCaptureDataOutputSynchronizer delegate
│   └── CameraCalibration.swift     ← intrinsic extraction + extrinsic storage
├── Vision/
│   └── BoxDetector.swift           ← VNDetectRectanglesRequest at 1920×1440
├── Stereo/
│   ├── StereoProcessor.h           ← ObjC interface
│   └── StereoProcessor.mm          ← C++17 / OpenCV pipeline (TODOs)
├── Measurement/
│   ├── PointCloudBuilder.swift     ← accumulates 3-D points
│   └── BoundingBoxFitter.swift     ← AABB → L×W×H
├── UI/
│   ├── CaptureView.swift           ← main camera screen
│   ├── CameraPreviewView.swift     ← UIViewRepresentable preview layer
│   ├── DimensionOverlayView.swift  ← L×W×H readout
│   └── CalibrationView.swift       ← optional checkerboard calibration UI
└── Resources/
    └── Info.plist
```

---

## 5. Phase 1 success criteria

Run on a physical iPhone Pro and verify these console logs:

```
[MultiCamSession] intrinsic matrix delivery enabled for builtInWideAngleCamera
[MultiCamSession] intrinsic matrix delivery enabled for builtInUltraWideCamera
[MultiCamSession] intrinsic matrix delivery enabled for builtInTelephotoCamera
[CameraCalibration] wide intrinsics — fx=... fy=... cx=... cy=... @ ...x...
[FrameSynchroniser] ts=... Δuw=<10ms Δtele=<10ms      ← timestamps within 10 ms
[MultiCamSession] session started
```

The live viewfinder must render from the wide camera. Launching on a non-Pro
device must show the "Multi-Camera Not Supported" screen.

---

## 6. Phase 2 — Next steps

1. **StereoProcessor.mm TODOs** — implement the 8 pipeline steps in order:
   wrapping YUV→greyscale, undistortion via `cv::remap`, FOV intersection mask,
   ORB detection, BFMatcher + Lowe's ratio test, `findFundamentalMat` RANSAC,
   `triangulatePoints`, low-texture edge fallback.

2. **CaptureView pipeline wiring** — connect `FrameSynchroniser.onFrame` →
   `BoxDetector` → `StereoProcessor` (×2 pairs) → `PointCloudBuilder` →
   `BoundingBoxFitter` → `CaptureViewModel.dimensions`.

3. **Optional stereoCalibrate** — complete `CalibrationView.runCalibration()` to
   collect checkerboard frames and call `cv::stereoCalibrate` via a new
   `StereoProcessor` method, then persist via `CameraCalibration`.

4. **Downsampling** — pipe frames through `vImageScale_Planar8` (Accelerate) to
   ~1 MP before feature matching; call `CameraIntrinsics.scaled(to:)` to keep
   intrinsics consistent.
