import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const sourcePath = path.resolve("contracts/ThemisEscrow.sol");
const source = fs.readFileSync(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: { "ThemisEscrow.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) {
  console.error(errors.map((entry) => entry.formattedMessage).join("\n"));
  process.exit(1);
}
const artifact = output.contracts["ThemisEscrow.sol"].ThemisEscrow;
console.log(`ThemisEscrow compiled: ${artifact.abi.length} ABI entries, ${artifact.evm.bytecode.object.length / 2} bytecode bytes`);
