import SwiftUI

struct DimensionOverlayView: View {
    let dimensions: BoxDimensions

    var body: some View {
        VStack(spacing: 4) {
            Text(dimensions.formatted)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text("L × W × H")
                .font(.caption)
                .foregroundColor(.white.opacity(0.7))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(radius: 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.top, 60)
    }
}
