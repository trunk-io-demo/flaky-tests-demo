// Deliberately trivial. This target exists so the package declares a product,
// which is what makes Xcode generate the scheme `xcodebuild test` runs; the
// tests under Tests/ do not import it. See ../Package.swift.

public enum SwiftTestingUpload {
    public static let name = "swift upload shapes"
}
