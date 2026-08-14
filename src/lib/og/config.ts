export const OG_NETWORK = {
  name: "0G Galileo Testnet",
  chainId: 16602,
  rpcUrl: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
  explorerUrl: "https://chainscan-galileo.0g.ai",
  storageIndexerUrl:
    process.env.OG_STORAGE_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai",
} as const;
