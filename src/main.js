import { join } from 'node:path';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { major } from 'semver';

const KONAN_URL = 'https://github.com/JetBrains/kotlin/releases/download';
const DEPENDENCIES_URL = 'https://download-cdn.jetbrains.com/kotlin/native';
const KOTLIN_VERSION = core.getInput('kotlin_version', {required: true});

const TOOLCHAIN_DOWNLOADS = {
  'K1_Linux_X64': [
    'llvm-11.1.0-linux-x64-essentials',
    'x86_64-unknown-linux-gnu-gcc-8.3.0-glibc-2.19-kernel-4.9-2',
    'aarch64-unknown-linux-gnu-gcc-8.3.0-glibc-2.25-kernel-4.9-2',
    'qemu-aarch64-static-5.1.0-linux-2',
    'libffi-3.2.1-2-linux-x86-64',
    'lldb-4-linux',
  ],
  'K1_Windows_X64': [
    'llvm-11.1.0-windows-x64-essentials',
    'msys2-mingw-w64-x86_64-2',
    'libffi-3.3-windows-x64-1',
    'lldb-4-windows',
  ],
  'K1_macOS_X64': [
    'apple-llvm-20200714-macos-x64-essentials',
    'libffi-3.2.1-3-darwin-macos',
    'lldb-4-macos',
  ],
  'K1_macOS_ARM64': [
    'apple-llvm-20200714-macos-aarch64-essentials',
    'libffi-3.3-1-macos-arm64',
    'lldb-4-macos',
  ],
  'K2_Linux_X64': [
    'resources/llvm/16.0.0-x86_64-linux/llvm-16.0.0-x86_64-linux-essentials-80',
    'x86_64-unknown-linux-gnu-gcc-8.3.0-glibc-2.19-kernel-4.9-2',
    'aarch64-unknown-linux-gnu-gcc-8.3.0-glibc-2.25-kernel-4.9-2',
    'qemu-aarch64-static-5.1.0-linux-2',
    'libffi-3.2.1-2-linux-x86-64',
    'lldb-4-linux',
  ],
  'K2_Windows_X64': [
    'resources/llvm/16.0.0-x86_64-windows/llvm-16.0.0-x86_64-windows-essentials-56',
    'msys2-mingw-w64-x86_64-2',
    'libffi-3.3-windows-x64-1',
  ],
  'K2_macOS_X64': [
    'resources/llvm/16.0.0-x86_64-macos/llvm-16.0.0-x86_64-macos-essentials-50',
    'libffi-3.2.1-3-darwin-macos',
    'lldb-4-macos',
  ],
  'K2_macOS_ARM64': [
    'resources/llvm/16.0.0-aarch64-macos/llvm-16.0.0-aarch64-macos-essentials-63',
    'libffi-3.3-1-macos-arm64',
    'lldb-4-macos',
  ],
};

/**
 * @param {string} version
 * @param {string} os
 * @param {string} arch
 */
async function download(version, os, arch) {
  const tools = TOOLCHAIN_DOWNLOADS[`K${major(version)}_${os}_${arch}`];
  if (!tools) return Promise.reject('Unsupported platform');
  const [ext, type] = os !== 'Windows' ? ['tar.gz', 'Tar'] : ['zip', 'Zip']
  const prebuilt_arch = {'X64': 'x86_64', 'ARM64': 'aarch64'}[arch];
  const konan_dir = await tc.downloadTool(
    `${KONAN_URL}/v${version}/kotlin-native-prebuilt-${os.toLowerCase()}-${prebuilt_arch}-${version}.${ext}`
  ).then(archive => tc[`extract${type}`](archive));
  const deps_dir = join(konan_dir, 'dependencies');
  for (const tool of tools) {
    await tc.downloadTool(`${DEPENDENCIES_URL}/${tool}.${ext}`)
      .then(archive => tc[`extract${type}`](archive, deps_dir));
  }
  return tc.cacheDir(konan_dir, 'konan', version);
}

export async function run() {
  const { RUNNER_OS, RUNNER_ARCH } = process.env;
  if (RUNNER_OS == 'Linux' && RUNNER_ARCH == 'ARM64') {
    core.setFailed('Linux arm64 runner is not supported');
  } else {
    let konan_dir = tc.find('konan', KOTLIN_VERSION);
    if (!konan_dir) {
      await download(KOTLIN_VERSION, RUNNER_OS, RUNNER_ARCH)
        .then(dir => { konan_dir = dir; })
        .catch(err => core.setFailed(err));
    }
    core.exportVariable('KONAN_DATA_DIR', konan_dir);
  }
}
