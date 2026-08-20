import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const sources = Object.fromEntries(["ThemisEscrow.sol", "DemoUSDC.sol"].map((name) => [name, { content: fs.readFileSync(path.resolve("contracts", name), "utf8") }]));
const input = {
  language: "Solidity",
  sources,
  settings: {
    evmVersion: "cancun",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: (name) => { const candidate = path.resolve("node_modules", name); return fs.existsSync(candidate) ? { contents: fs.readFileSync(candidate, "utf8") } : { error: `Import not found: ${name}` }; } }));
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) {
  console.error(errors.map((entry) => entry.formattedMessage).join("\n"));
  process.exit(1);
}
const artifact = output.contracts["ThemisEscrow.sol"].ThemisEscrow;
const tokenArtifact = output.contracts["DemoUSDC.sol"].DemoUSDC;
const generatedPath = path.resolve("src/generated/ThemisEscrow.json");
fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
fs.writeFileSync(
  generatedPath,
  `${JSON.stringify({
    contractName: "ThemisEscrow",
    compiler: solc.version(),
    evmVersion: "cancun",
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  }, null, 2)}\n`,
);
console.log(`ThemisEscrow compiled: ${artifact.abi.length} ABI entries, ${artifact.evm.bytecode.object.length / 2} bytecode bytes`);
console.log(`Artifact written to ${path.relative(process.cwd(), generatedPath)}`);
fs.writeFileSync(path.resolve("src/generated/DemoUSDC.json"), `${JSON.stringify({ contractName: "DemoUSDC", compiler: solc.version(), evmVersion: "cancun", abi: tokenArtifact.abi, bytecode: `0x${tokenArtifact.evm.bytecode.object}` }, null, 2)}\n`);
console.log(`DemoUSDC compiled: ${tokenArtifact.abi.length} ABI entries`);
