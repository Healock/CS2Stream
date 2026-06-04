import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PowerShell installer", () => {
  it("downloads the versioned package from the CDN and verifies it before installing", () => {
    const script = readFileSync("install.ps1", "utf8");

    expect(script).toContain('https://cdn.healock.cc/cs2stream/releases/cs2stream-$Version.tgz');
    expect(script).toContain('$MinimumNodeVersion = "20.18.1"');
    expect(script).toMatch(/\$ExpectedSha256 = "[0-9a-fA-F]{64}"/);
    expect(script).not.toContain('$ExpectedSha256 = "0000000000000000000000000000000000000000000000000000000000000000"');
    expect(script).toContain("Get-FileHash");
    expect(script).toContain("Package checksum mismatch");
    expect(script).toContain("install -g");
    expect(script).toContain("npm.cmd");
    expect(script).toContain("Remove-BlockedPowerShellShims");
    expect(script).toContain("Get-Command cs2stream");
  });

  it("bootstraps Node.js when it is missing or too old", () => {
    const script = readFileSync("install.ps1", "utf8");

    expect(script).toContain("function Install-Node");
    expect(script).toContain("function Install-PortableNode");
    expect(script).toContain("function Resolve-PortableNodeDownload");
    expect(script).toContain("winget install OpenJS.NodeJS.LTS");
    expect(script).toContain("choco install nodejs-lts -y");
    expect(script).toContain("scoop install nodejs-lts");
    expect(script).toContain("https://nodejs.org/dist/index.json");
    expect(script).toContain("Node.js is missing or older than");
    expect(script).toContain("Add-ToUserPath");
  });
});
