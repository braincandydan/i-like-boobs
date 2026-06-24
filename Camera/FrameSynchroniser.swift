import AVFoundation

struct SynchronisedFrameBundle {
    let wide:       CMSampleBuffer
    let ultrawide:  CMSampleBuffer
    let telephoto:  CMSampleBuffer
    /// Presentation timestamp of the wide frame (reference clock)
    let timestamp:  CMTime
}

final class FrameSynchroniser: NSObject {
    /// Called on a background queue for every synchronised frame bundle.
    var onFrame: ((SynchronisedFrameBundle) -> Void)?

    private let synchroniser: AVCaptureDataOutputSynchronizer
    private let queue = DispatchQueue(label: "com.stereomeasure.framesync", qos: .userInitiated)

    private let wideOutput:      AVCaptureVideoDataOutput
    private let ultrawideOutput: AVCaptureVideoDataOutput
    private let telephotOutput:  AVCaptureVideoDataOutput

    init(session: MultiCamSession) {
        self.wideOutput      = session.wideOutput
        self.ultrawideOutput = session.ultrawideOutput
        self.telephotOutput  = session.telephotOutput

        synchroniser = AVCaptureDataOutputSynchronizer(
            dataOutputs: [session.wideOutput, session.ultrawideOutput, session.telephotOutput]
        )
        super.init()
        synchroniser.setDelegate(self, queue: queue)
    }
}

extension FrameSynchroniser: AVCaptureDataOutputSynchronizerDelegate {
    func dataOutputSynchronizer(_ synchroniser: AVCaptureDataOutputSynchronizer,
                                didOutput collection: AVCaptureSynchronizedDataCollection) {
        guard
            let wideData  = collection.synchronizedData(for: wideOutput)      as? AVCaptureSynchronizedSampleBufferData,
            let uwData    = collection.synchronizedData(for: ultrawideOutput) as? AVCaptureSynchronizedSampleBufferData,
            let teleData  = collection.synchronizedData(for: telephotOutput)  as? AVCaptureSynchronizedSampleBufferData
        else { return }

        // Drop if any camera dropped a frame
        guard !wideData.sampleBufferWasDropped,
              !uwData.sampleBufferWasDropped,
              !teleData.sampleBufferWasDropped else {
            print("[FrameSynchroniser] frame dropped — skipping bundle")
            return
        }

        let wideTS   = CMSampleBufferGetPresentationTimeStamp(wideData.sampleBuffer)
        let uwTS     = CMSampleBufferGetPresentationTimeStamp(uwData.sampleBuffer)
        let teleTS   = CMSampleBufferGetPresentationTimeStamp(teleData.sampleBuffer)

        let diffUW   = abs(CMTimeGetSeconds(wideTS) - CMTimeGetSeconds(uwTS))
        let diffTele = abs(CMTimeGetSeconds(wideTS) - CMTimeGetSeconds(teleTS))
        print(String(format: "[FrameSynchroniser] ts=%.4f  Δuw=%.2fms  Δtele=%.2fms",
                     CMTimeGetSeconds(wideTS), diffUW * 1000, diffTele * 1000))

        let bundle = SynchronisedFrameBundle(
            wide:      wideData.sampleBuffer,
            ultrawide: uwData.sampleBuffer,
            telephoto: teleData.sampleBuffer,
            timestamp: wideTS
        )
        onFrame?(bundle)
    }
}
