import Flutter
import UIKit

class NativeBlurView: NSObject, FlutterPlatformView {
    private let imageView: UIImageView
    
    init(
        frame: CGRect,
        viewIdentifier viewId: Int64,
        arguments args: Any?,
        binaryMessenger messenger: FlutterBinaryMessenger?
    ) {
        imageView = UIImageView(frame: frame)
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        
        super.init()
        
        // Extract parameters from Flutter
        if let params = args as? [String: Any],
           let imageUrl = params["imageUrl"] as? String {
            loadAndBlurImage(urlString: imageUrl)
        }
    }
    
    func view() -> UIView {
        return imageView
    }
    
    private func loadAndBlurImage(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        
        // Download image asynchronously
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self,
                  let data = data,
                  let image = UIImage(data: data) else { return }
            
            // Apply blur on background thread
            DispatchQueue.global(qos: .userInitiated).async {
                let blurredImage = self.applyBlur(to: image, radius: 15.0)
                
                // Update UI on main thread
                DispatchQueue.main.async {
                    self.imageView.image = blurredImage
                }
            }
        }.resume()
    }
    
    private func applyBlur(to inputImage: UIImage, radius: CGFloat) -> UIImage? {
        guard let ciImage = CIImage(image: inputImage) else { return inputImage }
        
        // Create Gaussian Blur filter (matching Android's BlurTransformation)
        let filter = CIFilter(name: "CIGaussianBlur")
        filter?.setValue(ciImage, forKey: kCIInputImageKey)
        filter?.setValue(radius, forKey: kCIInputRadiusKey)
        
        guard let outputImage = filter?.outputImage else { return inputImage }
        
        // Render blurred image
        let context = CIContext(options: nil)
        guard let cgImage = context.createCGImage(outputImage, from: ciImage.extent) else {
            return inputImage
        }
        
        return UIImage(cgImage: cgImage)
    }
}
