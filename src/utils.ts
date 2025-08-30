import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from "@solana/web3.js";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Add USE_LIGHTSPEED configuration
export const USE_LIGHTSPEED = process.env.USE_LIGHTSPEED === 'true'; // defaults to false if not set

// Validate required environment variables
if (!process.env.RPC_ENDPOINT) {
  throw new Error('RPC_ENDPOINT is not set in .env file');
}

if (!process.env.RPC_LIGHTSPEED_ENDPOINT) {
  throw new Error('RPC_LIGHTSPEED_ENDPOINT is not set in .env file');
}

if (!process.env.WALLET_PATH) {
  throw new Error('WALLET_PATH is not set in .env file');
}

// After existing environment variable validation
if (!process.env.DEFAULT_RECIPIENT) {
  console.warn('⚠️  DEFAULT_RECIPIENT not set in .env file, using placeholder');
}

// Add export for DEFAULT_RECIPIENT
export const DEFAULT_RECIPIENT = process.env.DEFAULT_RECIPIENT || 'So11111111111111111111111111111111111111112';

// Configuration constants
export const WALLET_PATH = path.resolve(process.env.WALLET_PATH);
export const TIPS_VIBE_FEE = 1000000; // 0.001 SOL tip for priority processing
export const TIPS_VIBE_STATION = new PublicKey('53PhM3UTdMQWu5t81wcd35AHGc5xpmHoRjem7GQPvXjA');

// RPC Endpoints from environment
export const RPC_ENDPOINT = process.env.RPC_ENDPOINT;
export const RPC_LIGHTSPEED_ENDPOINT = process.env.RPC_LIGHTSPEED_ENDPOINT;

// Connection instances
export const connection = new Connection(RPC_ENDPOINT, 'processed');
const selectedEndpoint = USE_LIGHTSPEED ? RPC_LIGHTSPEED_ENDPOINT : RPC_ENDPOINT;
export const txSenderConnection = new Connection(selectedEndpoint, 'processed')

/**
 * Load wallet from JSON file
 */
export function loadWallet(walletPath: string): Keypair {
  const walletJson = fs.readFileSync(walletPath, 'utf-8');
  const secretKey = Uint8Array.from(JSON.parse(walletJson));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Add priority tip instruction to any transaction
 */
export function addLightSpeedTip(instructions: TransactionInstruction[], fromPubkey: PublicKey) {
  if (!USE_LIGHTSPEED) {
    console.log("ℹ️  LightSpeed tips disabled (USE_LIGHTSPEED=false)");
    return;
  }
  
  console.log("💨 Adding LightSpeed tip...");
  instructions.push(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: TIPS_VIBE_STATION,
      lamports: TIPS_VIBE_FEE,
    })
  );
}

/**
 * Add compute budget instructions for priority processing
 */
export function addComputeBudget(instructions: TransactionInstruction[], computeUnits = 200000, priorityFee = 1000) {
  instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
  );
}

/**
 * Send transaction with retries through lightspeed endpoint
 */
export async function sendTxWithRetries(
  tx: VersionedTransaction, 
  maxAttempts = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const signature = await txSenderConnection.sendRawTransaction(tx.serialize(), {
        preflightCommitment: "processed",
        skipPreflight: true,
        maxRetries: 3,
      });
      
      if (!signature) throw new Error('No signature returned');
      
      console.log(`Transaction sent (attempt ${attempt}): ${signature}`);
      return signature;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxAttempts) {
        console.error('Max retries reached');
      }
    }
  }
  return null;
}

/**
 * Check balance for operations
 */
export async function checkBalanceForOperations(
  wallet: Keypair,
  requiredLamports: number,
  description?: string
): Promise<boolean> {
  const balance = await connection.getBalance(wallet.publicKey);
  
  // Add tip fee only if LightSpeed is enabled
  const totalRequired = USE_LIGHTSPEED 
    ? requiredLamports + TIPS_VIBE_FEE 
    : requiredLamports;
  
  if (balance < totalRequired) {
    console.error(`Insufficient balance${description ? ` for ${description}` : ''}`);
    console.error(`Have: ${balance / LAMPORTS_PER_SOL} SOL`);
    console.error(`Need: ${totalRequired / LAMPORTS_PER_SOL} SOL`);
    if (USE_LIGHTSPEED) {
      console.error(`(includes ${TIPS_VIBE_FEE / LAMPORTS_PER_SOL} SOL LightSpeed tip)`);
    }
    return false;
  }
  
  console.log(`Balance check passed${description ? ` for ${description}` : ''}`);
  console.log(`Available: ${balance / LAMPORTS_PER_SOL} SOL`);
  console.log(`Required: ${requiredLamports / LAMPORTS_PER_SOL} SOL`);
  if (USE_LIGHTSPEED) {
    console.log(`LightSpeed tip: ${TIPS_VIBE_FEE / LAMPORTS_PER_SOL} SOL`);
    console.log(`Total with tip: ${totalRequired / LAMPORTS_PER_SOL} SOL`);
  }
  console.log(`Remaining after: ${(balance - totalRequired) / LAMPORTS_PER_SOL} SOL`);
  return true;
}


/**
 * Monitor transaction status
 */
export async function monitorTransactionStatus(signature: string, maxWaitTime = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await connection.getSignatureStatus(signature);
    
    if (status.value?.confirmationStatus === 'confirmed' || 
        status.value?.confirmationStatus === 'finalized') {
      console.log(`Transaction confirmed: ${signature}`);
      console.log(`Status: ${status.value.confirmationStatus}`);
      return status.value;
    }
    
    if (status.value?.err) {
      console.error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      return null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error('Transaction confirmation timeout');
  return null;
}
