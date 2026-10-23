"use strict";

// Compile the actual adapter, transcoder and vendored Hunspell with sanitizers.
// Keeping Node out of this executable also lets LeakSanitizer inspect shutdown.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const temporaryRoot = fs.realpathSync(os.tmpdir());
const buildDirectory = fs.mkdtempSync(path.join(temporaryRoot, "native-spelling-asan-"));
const windows = process.platform === "win32";
const sourceDirectory = path.join(root, "vendor", "hunspell", "src", "hunspell");
const hunspellSources = [
  "affentry",
  "affixmgr",
  "csutil",
  "filemgr",
  "hashmgr",
  "hunspell",
  "hunspelltrace",
  "hunzip",
  "phonet",
  "replist",
  "suggestmgr",
].map((name) => path.join(sourceDirectory, `${name}.cxx`));
const sources = [
  path.join(root, "spec", "native", "hunspell-memory.cc"),
  path.join(root, "src", "spellchecker_hunspell.cc"),
  path.join(root, "src", `transcoder_${windows ? "win" : "posix"}.cc`),
  ...hunspellSources,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: buildDirectory,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal || result.status})`);
  }
}

function windowsEnvironment() {
  const vswhere = path.join(
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  const discovered = spawnSync(
    vswhere,
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "Microsoft.VisualStudio.Component.VC.ASAN",
      "-property",
      "installationPath",
    ],
    { encoding: "utf8" },
  );
  if (discovered.error) throw discovered.error;
  const installation = discovered.stdout.trim();
  if (discovered.status !== 0 || !installation) {
    throw new Error("Install the Visual Studio C++ tools and AddressSanitizer component.");
  }
  const developerCommand = path.join(installation, "Common7", "Tools", "VsDevCmd.bat");
  const environmentScript = path.join(buildDirectory, "developer-environment.cmd");
  fs.writeFileSync(
    environmentScript,
    `@echo off\r\ncall "${developerCommand}" -no_logo -arch=x64 -host_arch=x64 >nul\r\nif errorlevel 1 exit /b %errorlevel%\r\nset\r\n`,
  );
  const result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", environmentScript], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Cannot initialize the Visual Studio environment.");
  const environment = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) environment[line.slice(0, separator)] = line.slice(separator + 1);
  }
  delete environment.CI;
  return environment;
}

try {
  const executable = path.join(buildDirectory, windows ? "hunspell-memory.exe" : "hunspell-memory");
  const environment = windows ? windowsEnvironment() : { ...process.env };
  delete environment.CI;

  if (windows) {
    run(
      "cl.exe",
      [
        "/nologo",
        "/std:c++20",
        "/EHsc",
        "/utf-8",
        "/MD",
        "/Zi",
        "/Od",
        "/fsanitize=address",
        "/DHUNSPELL_STATIC",
        "/DUSE_HUNSPELL",
        `/I${path.join(root, "src")}`,
        `/I${sourceDirectory}`,
        ...sources,
        `/Fe:${executable}`,
        "/link",
        "/INCREMENTAL:NO",
      ],
      { env: environment },
    );
  } else {
    run(
      process.env.CXX || "c++",
      [
        "-std=c++20",
        "-g",
        "-O1",
        "-fno-omit-frame-pointer",
        "-fsanitize=address,undefined",
        "-pthread",
        "-DHUNSPELL_STATIC",
        "-DUSE_HUNSPELL",
        `-I${path.join(root, "src")}`,
        `-I${sourceDirectory}`,
        ...sources,
        ...(process.platform === "darwin" ? ["-liconv"] : []),
        "-o",
        executable,
      ],
      { env: environment },
    );
  }

  environment.ASAN_OPTIONS = [
    environment.ASAN_OPTIONS,
    "halt_on_error=1",
    ...(process.platform === "linux" ? ["detect_leaks=1"] : []),
  ]
    .filter(Boolean)
    .join(":");
  environment.UBSAN_OPTIONS = "halt_on_error=1:print_stacktrace=1";
  run(executable, [path.join(buildDirectory, "dictionaries")], { env: environment });
  console.log(
    windows
      ? "Native memory checks passed with MSVC AddressSanitizer (leak detection unavailable)."
      : process.platform === "linux"
        ? "Native memory checks passed with AddressSanitizer, UndefinedBehaviorSanitizer and leak detection."
        : "Native memory checks passed with AddressSanitizer and UndefinedBehaviorSanitizer (leak detection unavailable).",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Only remove the unique temporary directory created by this invocation.
  if (
    path.dirname(buildDirectory) === temporaryRoot &&
    path.basename(buildDirectory).startsWith("native-spelling-asan-")
  ) {
    fs.rmSync(buildDirectory, { recursive: true, force: true });
  }
}
