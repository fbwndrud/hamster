import Darwin
import Foundation

let args = CommandLine.arguments
guard args.count == 3, let parent = Int32(args[1]), parent > 1 else { exit(1) }
let installed = URL(fileURLWithPath: args[2])
let stage = URL(fileURLWithPath: args[0]).deletingLastPathComponent()
let next = stage.appendingPathComponent("Hamster.app")
let ready = stage.appendingPathComponent("ready")
let handoff = stage.appendingPathComponent("handoff")
let files = FileManager.default

guard stage.lastPathComponent.hasPrefix(".hamster-update-"),
      stage.deletingLastPathComponent().standardizedFileURL.path == installed.deletingLastPathComponent().standardizedFileURL.path
else { exit(1) }

func wait(seconds: Double, until condition: () -> Bool) -> Bool {
    let deadline = ProcessInfo.processInfo.systemUptime + seconds
    while !condition() {
        if ProcessInfo.processInfo.systemUptime >= deadline { return false }
        Thread.sleep(forTimeInterval: 0.05)
    }
    return true
}

func exchange() -> Bool {
    renameatx_np(AT_FDCWD, next.path, AT_FDCWD, installed.path, UInt32(RENAME_SWAP)) == 0
}

func launchPrevious() {
    try? files.removeItem(at: handoff)
    let reopen = Process()
    reopen.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    reopen.arguments = ["-n", installed.path, "--args", "--hamster-update-failed"]
    do {
        try reopen.run()
        reopen.waitUntilExit()
    } catch {}
}

guard wait(seconds: 20, until: { kill(parent, 0) == -1 && errno == ESRCH }),
      files.fileExists(atPath: handoff.path) else {
    try? files.removeItem(at: stage)
    exit(1)
}
guard exchange() else {
    launchPrevious()
    try? files.removeItem(at: stage)
    exit(1)
}

let app = Process()
app.executableURL = installed.appendingPathComponent("Contents/MacOS/Electron")
app.arguments = ["--hamster-update-ready=" + ready.path]
do {
    try app.run()
    let completed = wait(seconds: 18, until: { files.fileExists(atPath: ready.path) || !app.isRunning })
    if completed && app.isRunning && files.fileExists(atPath: ready.path) {
        try? files.removeItem(at: stage)
        exit(0)
    }
    if app.isRunning {
        app.terminate()
        if !wait(seconds: 3, until: { !app.isRunning }) {
            kill(app.processIdentifier, SIGKILL)
            app.waitUntilExit()
        }
    }
} catch {}

if exchange() {
    launchPrevious()
    try? files.removeItem(at: stage)
}
exit(1)
