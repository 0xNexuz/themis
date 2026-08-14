"use client";

import { BrowserProvider, ContractFactory, getAddress, isAddress } from "ethers";
import type { JsonFragment } from "ethers";
import { useState } from "react";

type ContractArtifact = {
  abi: JsonFragment[];
  bytecode: string;
  compiler: string;
  evmVersion: string;
};

const GALILEO = {
  chainId: "0x40DA",
  chainName: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
};

export default function DeployEscrow() {
  const [verifier, setVerifier] = useState("");
  const [status, setStatus] = useState("");
  const [address, setAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [deploying, setDeploying] = useState(false);

  async function deploy() {
    if (!window.ethereum) {
      setStatus("Install an EVM wallet such as MetaMask or Rabby first.");
      return;
    }
    if (verifier && !isAddress(verifier)) {
      setStatus("Enter a valid verifier address, or leave it empty to use the connected wallet.");
      return;
    }

    setDeploying(true);
    setAddress("");
    setTxHash("");
    try {
      setStatus("Connecting wallet…");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: GALILEO.chainId }] });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [GALILEO] });
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const verifierAddress = verifier ? getAddress(verifier) : signerAddress;
      const response = await fetch("/api/contracts/themis-escrow");
      if (!response.ok) throw new Error("Contract artifact is unavailable");
      const artifact = (await response.json()) as ContractArtifact;

      setStatus("Confirm the deployment transaction in your wallet…");
      const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
      const contract = await factory.deploy(verifierAddress);
      const deploymentTx = contract.deploymentTransaction();
      setTxHash(deploymentTx?.hash ?? "");
      setStatus("Waiting for Galileo confirmation…");
      await contract.waitForDeployment();
      setAddress(await contract.getAddress());
      setStatus("ThemisEscrow deployed. Save the address below.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Deployment was not completed.");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="wallet-deployer">
      <div>
        <span>Verifier address</span>
        <input value={verifier} onChange={(event) => setVerifier(event.target.value)} placeholder="0x… (blank = connected wallet)" disabled={deploying} />
      </div>
      <button type="button" onClick={deploy} disabled={deploying}>{deploying ? "Deploying…" : "Deploy on Galileo"}<b>↗</b></button>
      {status && <p>{status}</p>}
      {address && <code>{address}</code>}
      {txHash && <a href={`https://chainscan-galileo.0g.ai/tx/${txHash}`} target="_blank" rel="noreferrer">View deployment transaction ↗</a>}
    </div>
  );
}
