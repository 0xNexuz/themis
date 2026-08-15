import fs from "node:fs";
import { ContractFactory, Wallet, formatEther } from "ethers";
import artifact from "../src/generated/ThemisEscrow.json" with { type: "json" };

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/=(.*)/s).slice(0, 2)),
);
const rpcUrl = env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
let rpcId = 0;
async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${method}: ${payload.error.message}`);
  return payload.result;
}

const wallet = new Wallet(env.THEMIS_DEPLOYER_PRIVATE_KEY);
const verifier = new Wallet(env.THEMIS_VERIFIER_PRIVATE_KEY).address;
const chainId = BigInt(await rpc("eth_chainId"));
if (chainId !== 16602n) throw new Error(`Refusing deployment on chain ${chainId}`);

const factory = new ContractFactory(artifact.abi, artifact.bytecode);
const deployment = await factory.getDeployTransaction(verifier, 24 * 60 * 60);
const [balanceHex, nonceHex, gasPriceHex, gasHex] = await Promise.all([
  rpc("eth_getBalance", [wallet.address, "latest"]),
  rpc("eth_getTransactionCount", [wallet.address, "pending"]),
  rpc("eth_gasPrice"),
  rpc("eth_estimateGas", [{ from: wallet.address, data: deployment.data }]),
]);
const balance = BigInt(balanceHex);
const nonce = Number(BigInt(nonceHex));
const gasPrice = BigInt(gasPriceHex);
const estimatedGas = BigInt(gasHex);
const gasLimit = estimatedGas * 120n / 100n;
const estimatedCost = gasLimit * gasPrice;
if (balance <= estimatedCost) throw new Error("Insufficient 0G for deployment gas");

console.log(JSON.stringify({
  phase: "simulation",
  deployer: wallet.address,
  verifier,
  chainId: chainId.toString(),
  nonce,
  balance0G: formatEther(balance),
  estimatedGas: estimatedGas.toString(),
  gasLimit: gasLimit.toString(),
  estimatedMaximumCost0G: formatEther(estimatedCost),
}));

const signed = await wallet.signTransaction({
  chainId,
  nonce,
  data: deployment.data,
  gasLimit,
  gasPrice,
  type: 0,
});
const transactionHash = await rpc("eth_sendRawTransaction", [signed]);
console.log(JSON.stringify({ phase: "broadcast", transactionHash }));

let receipt = null;
for (let attempt = 0; attempt < 90 && !receipt; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  receipt = await rpc("eth_getTransactionReceipt", [transactionHash]);
}
if (!receipt) throw new Error(`Transaction confirmation timed out: ${transactionHash}`);
if (BigInt(receipt.status) !== 1n) throw new Error(`Deployment reverted: ${transactionHash}`);
const remaining = BigInt(await rpc("eth_getBalance", [wallet.address, "latest"]));
console.log(JSON.stringify({
  phase: "confirmed",
  contractAddress: receipt.contractAddress,
  transactionHash,
  blockNumber: Number(BigInt(receipt.blockNumber)),
  gasUsed: BigInt(receipt.gasUsed).toString(),
  remaining0G: formatEther(remaining),
}));
