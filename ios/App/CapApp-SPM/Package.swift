// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
//
// EXCEPT FOR ONE THING, and it is not optional. `npx cap sync ios` writes plugin paths with the HOST's
// separator, so running it on Windows emits `path: "..\..\..\node_modules\@capacitor\browser"`. Swift
// Package Manager on the CI Mac cannot resolve that, and the failure is a package-resolution error on a
// remote machine — invisible from Windows, where nothing ever reads this file. Paths here must be
// POSIX. `npm run cap:sync` re-normalises them after every sync, and `capacitorConfig.test.ts` fails if
// a backslash comes back.
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorBrowser", path: "../../../node_modules/@capacitor/browser")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser")
            ]
        )
    ]
)
