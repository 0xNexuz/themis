import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const sourcePath = path.resolve("contracts/ThemisEscrow.sol");
const source = fs.readFileSync(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: { "ThemisEscrow.sol": { content: source } },
  settings: {
    evmVersion: "cancun",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) {
  console.error(errors.map((entry) => entry.formattedMessage).join("\n"));
  process.exit(1);
}
const artifact = output.contracts["ThemisEscrow.sol"].ThemisEscrow;
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
