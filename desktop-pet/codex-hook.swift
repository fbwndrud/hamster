import CryptoKit
import Darwin
import Foundation

let provider = CommandLine.arguments.dropFirst().first ?? "codex"
let events: [String: [String: String]] = [
    "codex": ["UserPromptSubmit": "submitted", "Stop": "finished", "Interrupt": "interrupted"],
    "claude": ["UserPromptSubmit": "submitted", "Stop": "finished", "StopFailure": "interrupted", "SessionEnd": "sessionEnded"],
    "cursor": ["beforeSubmitPrompt": "submitted", "stop": "finished", "sessionEnd": "sessionEnded"],
    "gemini": ["BeforeAgent": "submitted", "AfterAgent": "finished", "SessionEnd": "sessionEnded"],
    "grok": ["UserPromptSubmit": "submitted", "Stop": "finished", "StopFailure": "interrupted",
             "StopCancelled": "interrupted", "SessionEnd": "sessionEnded", "Notification": "sessionEnded"]
]

func hash(_ parts: [String]) -> String? {
    guard let data = try? JSONSerialization.data(withJSONObject: parts) else { return nil }
    return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

func forward(_ event: [String: Any], _ name: String) {
    guard var signal = events[provider]?[name] else { return }
    // Grok also runs the Claude and Cursor hook files; its own hook file reports for it.
    if (provider == "claude" || provider == "cursor") && event["hookEventName"] != nil { return }
    if provider == "grok" {
        if event["subagentType"] != nil { return }
        // A second Stop fires at session end; SessionEnd reports that.
        if name == "Stop" && (event["reason"] as? String) != "end_turn" { return }
        // The idle ping settles turns that ended without a report, such as a rewind.
        if name == "Notification" && (event["notificationType"] ?? event["notification_type"]) as? String != "idle_prompt" { return }
    }
    let sessionField = provider == "cursor" ? "conversation_id" : provider == "grok" ? "sessionId" : "session_id"
    let turnField = ["codex": "turn_id", "claude": "prompt_id", "cursor": "generation_id", "gemini": "prompt_id", "grok": "promptId"]
    guard let field = turnField[provider],
          let session = (event[sessionField] ?? event["session_id"]) as? String, !session.isEmpty else { return }
    let turn = (event[field] as? String).flatMap { $0.isEmpty ? nil : $0 }
    if provider == "cursor" && name == "stop" && (event["status"] as? String) != "completed" {
        signal = "interrupted"
    }

    guard let scope = hash([provider, session]),
          let id = hash(provider == "codex" ? [session, turn ?? session] : [provider, session, turn ?? session])
    else { return }
    var message: [String: Any] = [
        "provider": provider,
        "type": signal,
        "id": signal == "sessionEnded" ? scope : id,
        "scope": scope
    ]
    if turn == nil { message["reusable"] = true }
    if signal == "submitted" && (provider == "claude" || provider == "gemini" || provider == "grok") {
        message["supersede"] = true
    }
    guard var payload = try? JSONSerialization.data(withJSONObject: message) else { return }
    payload.append(10)
    sendSignal(payload)
}

func sendSignal(_ payload: Data) {
    let socketPath = "/private/tmp/codex-hamster-\(getuid())/events.sock"
    let fd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard fd >= 0 else { return }
    defer { close(fd) }
    var enabled: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &enabled, socklen_t(MemoryLayout<Int32>.size))
    guard fcntl(fd, F_SETFL, O_NONBLOCK) == 0 else { return }

    var address = sockaddr_un()
    let pathname = Array(socketPath.utf8) + [0]
    guard pathname.count <= MemoryLayout.size(ofValue: address.sun_path) else { return }
    address.sun_family = sa_family_t(AF_UNIX)
    address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
    withUnsafeMutableBytes(of: &address.sun_path) { $0.copyBytes(from: pathname) }
    let connected = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
        }
    }
    guard connected == 0 else { return }
    payload.withUnsafeBytes { bytes in
        guard let start = bytes.baseAddress else { return }
        var written = 0
        while written < bytes.count {
            let count = send(fd, start + written, bytes.count - written, 0)
            if count <= 0 { return }
            written += count
        }
    }
}

let maxInput = 4_000_000
let input = FileHandle.standardInput.readData(ofLength: maxInput + 1)
var output = provider == "cursor" ? "{\"continue\":true}" : "{}"
if input.count <= maxInput,
   let event = (try? JSONSerialization.jsonObject(with: input)) as? [String: Any],
   let name = event["hook_event_name"] as? String {
    forward(event, name)
    if provider == "cursor" && name != "beforeSubmitPrompt" { output = "{}" }
}
print(output)
