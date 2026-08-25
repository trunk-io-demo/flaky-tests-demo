// swift-tools-version: 6.0

// Swift Testing ships with the toolchain as of Swift 6, so `import Testing`
// needs no package dependency. This package has none at all, which keeps the
// suite's job to demonstrating upload behavior.

import PackageDescription

let package = Package(
    name: "SwiftTestingUpload",
    targets: [
        .testTarget(name: "SwiftTestingUploadTests", path: "Tests")
    ]
)
