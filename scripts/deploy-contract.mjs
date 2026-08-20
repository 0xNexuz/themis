import fs from "node:fs";
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers";
import escrowArtifact from "../src/generated/ThemisEscrow.json" with { type: "json" };
import tokenArtifact from "../src/generated/DemoUSDC.json" with { type: "json" };

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => line.split(/=(.*)/s).slice(0, 2)));
const provider = new JsonRpcProvider(env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai", 16602, { staticNetwork: true });
const deployer = new Wallet(env.THEMIS_DEPLOYER_PRIVATE_KEY, provider);
const verifier = new Wallet(env.THEMIS_VERIFIER_PRIVATE_KEY).address;
const resolver = env.THEMIS_RESOLVER_ADDRESS || deployer.address;
const network = await provider.getNetwork();
if (network.chainId !== 16602n) throw new Error(`Refusing deployment on chain ${network.chainId}`);
const balance = await provider.getBalance(deployer.address);
console.log(JSON.stringify({ phase: "preflight", deployer: deployer.address, verifier, resolver, balance0G: formatEther(balance) }));

const token = await new ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, deployer).deploy();
await token.waitForDeployment();
const tokenReceipt = await token.deploymentTransaction().wait();
const escrow = await new ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode, deployer).deploy(deployer.address, verifier, resolver, 86400);
await escrow.waitForDeployment();
const escrowReceipt = await escrow.deploymentTransaction().wait();
console.log(JSON.stringify({ phase: "confirmed", chainId: "16602", demoUSDC: { address: await token.getAddress(), transactionHash: tokenReceipt.hash }, escrowV2: { address: await escrow.getAddress(), transactionHash: escrowReceipt.hash }, remaining0G: formatEther(await provider.getBalance(deployer.address)) }));
