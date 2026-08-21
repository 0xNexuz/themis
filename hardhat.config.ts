import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import { defineConfig } from "hardhat/config";
export default defineConfig({ plugins: [hardhatEthers, hardhatNodeTestRunner], solidity: { type: "solc", version: "0.8.36", path: new URL("./node_modules/solc/soljson.js", import.meta.url).pathname.replace(/^\/(.:)/, "$1"), settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } }, paths: { sources: "./contracts", tests: { nodejs: "./contract-tests" }, cache: "./.hardhat-cache", artifacts: "./artifacts" } });
