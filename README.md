# Solana LightSpeed Examples

Example code for integrating Solana Vibe Station's LightSpeed service into your Solana transactions.

## What is this?

This repository provides TypeScript examples showing how to add LightSpeed priority tips (0.001001 SOL) to different types of Solana transactions. The tips ensure your transactions get priority processing through SVS's LightSpeed RPC endpoints.

## Setup

1. Clone the repo and install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your configuration:
```bash
RPC_ENDPOINT=https://epic.rpc.solanavibestation.com/?api_key=YOUR_API_KEY
RPC_LIGHTSPEED_ENDPOINT=https://basic.swqos.solanavibestation.com/lightspeed?api_key=YOUR_API_KEY
WALLET_PATH=./wallets/wallet.json
USE_LIGHTSPEED=true
DEFAULT_RECIPIENT=YOUR_WALLET_ADDRESS
```

3. Add your wallet JSON file to the `wallets/` folder

4. Run examples:
```bash
npm run dev
```

## Available Examples

### 1. SOL Transfer (`src/examples/native.ts`)
Send native SOL with LightSpeed tip
```typescript
await solTransfer(); // uses default recipient
await solTransfer('RECIPIENT_ADDRESS'); // custom recipient
```

### 2. Jupiter Swap (`src/examples/jupiter.ts`)
Swap SOL to USDC via Jupiter with LightSpeed tip
```typescript
await jupiterSwapSOLtoUSDC(); // swaps 0.001 SOL to USDC
```

### 3. Token Transfer (`src/examples/native.ts`)
Send SPL tokens (defaults to USDC) with LightSpeed tip
```typescript
await tokenTransfer(); // minimum USDC to default recipient
await tokenTransfer('RECIPIENT', 'TOKEN_MINT', amount); // custom token
```

## Configuration

- Set `USE_LIGHTSPEED=false` in `.env` to disable priority tips
- When enabled, adds 0.001001 SOL tip to transactions for priority processing

## Requirements

- Node.js 16+
- Solana wallet with SOL for testing
- SVS API key (get from [Solana Vibe Station](https://solanavibestation.com))
