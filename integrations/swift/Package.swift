// swift-tools-version: 6.0

// Swift Testing ships with the toolchain as of Swift 6, so `import Testing`
// needs no package dependency. This package has none at all, which keeps the
// suite's job to demonstrating upload behavior.
//
// The library product exists only so `xcodebuild` has a scheme to run. Xcode
// generates schemes from products, and a package declaring nothing but a test
// target gets none — which is why `-scheme SwiftTestingUpload` failed with
// "does not contain a scheme" before this was here. `swift test` never needed it.

import PackageDescription

let package = Package(
    name: "SwiftTestingUpload",
    products: [
        .library(name: "SwiftTestingUpload", targets: ["SwiftTestingUpload"])
    ],
    targets: [
        .target(name: "SwiftTestingUpload", path: "Sources"),
        .testTarget(name: "SwiftTestingUploadTests", path: "Tests"),
    ]
)
