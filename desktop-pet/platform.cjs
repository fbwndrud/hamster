const os = require('node:os');
const path = require('node:path');
const {eventEndpoint} = require('./hook-bridge.cjs');

// `windows` is a plain flag so tests on macOS can exercise the Windows branches.
const platform = {windows:process.platform === 'win32'};

function runtimeDirectory() {
  if (platform.windows) {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local');
    return path.join(local,'Hamster','run');
  }
  return '/private/tmp/codex-hamster-' + process.getuid();
}

// Windows has no POSIX owner or mode bits; the per-user profile folders are private by their ACLs.
const ownedByCurrentUser = stat => platform.windows || stat.uid === process.getuid();
const isPrivate = stat => platform.windows || (stat.mode & 0o077) === 0;
const notWritableByOthers = stat => platform.windows || (stat.mode & 0o022) === 0;
const isPrivateExecutable = stat => platform.windows || (stat.mode & 0o722) === 0o700;

// Windows listens on a named pipe, which has no file to check, delete, or chmod.
const endpoint = () => eventEndpoint({windows:platform.windows});

module.exports = {platform,runtimeDirectory,ownedByCurrentUser,isPrivate,notWritableByOthers,isPrivateExecutable,endpoint};
