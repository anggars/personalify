import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    
    // Register native blur view (matching Android's "native-glass")
    guard let registrar = self.registrar(forPlugin: "native-glass") else {
      return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
    
    let factory = NativeBlurViewFactory(messenger: registrar.messenger())
    registrar.register(factory, withId: "native-glass")
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

