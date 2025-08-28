import axios from 'axios';
import { 
  ComputeBudgetProgram,
  PublicKey, 
  TransactionMessage, 
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  AddressLookupTableAccount
} from "@solana/web3.js";
import {
  WALLET_PATH,
  TIPS_VIBE_FEE,
  connection,
  loadWallet,
  addLightSpeedTip,
  sendTxWithRetries,
  checkBalanceForOperations,
  monitorTransactionStatus
} from '../utils';

/**
 * Jupiter Swap (SOL to USDC) with LightSpeed Tip
 * Full implementation
 */
export async function jupiterSwapSOLtoUSDC() {
  console.log("\n=== Jupiter Swap (SOL → USDC) with LightSpeed Tip ===");
  
  const wallet = loadWallet(WALLET_PATH);
  
  // Token addresses
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  
  // Swap parameters
  const amountIn = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
  const slippageBps = 100; // 1% slippage
  
  // Calculate costs
  const priorityFee = 50000; // 0.00005 SOL priority
  const totalNeeded = amountIn + 10000 + priorityFee; // Don't add TIPS_VIBE_FEE here, automatically added later
  
  console.log(`Swap details:`);
  console.log(`- Input: ${amountIn / LAMPORTS_PER_SOL} SOL`);
  console.log(`- Output: USDC`);
  console.log(`- Slippage: ${slippageBps / 100}%`);
  console.log(`- Total needed pre-tip: ${totalNeeded / LAMPORTS_PER_SOL} SOL`);
  console.log(`- LightSpeed tip: ${TIPS_VIBE_FEE / LAMPORTS_PER_SOL} SOL`);
  
  // Check balance
  const hasBalance = await checkBalanceForOperations(wallet, totalNeeded, "Jupiter swap");
  if (!hasBalance) {
    return;
  }
  
  try {
    // Step 1: Get quote
    console.log("\nGetting quote from Jupiter...");
    const quoteResponse = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: amountIn.toString(),
        slippageBps: slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      }
    });
    
    const quote = quoteResponse.data;
    const outAmount = parseInt(quote.outAmount);
    console.log(`- Expected output: ${(outAmount / 1000000).toFixed(4)} USDC`);
    console.log(`- Route: ${quote.routePlan.map((r: any) => r.swapInfo.label).join(' → ')}`);
    console.log(`- Price impact: ${quote.priceImpactPct}%`);
    
    // Step 2: Get swap instructions
    console.log("\nGetting swap instructions...");
    const instructionsResponse = await axios.post(
      'https://quote-api.jup.ag/v6/swap-instructions',
      {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      }
    );
    
    if (!instructionsResponse.data) {
      throw new Error("No instructions received from Jupiter");
    }
    
    const {
      computeBudgetInstructions,
      setupInstructions,
      swapInstruction,
      cleanupInstruction,
      addressLookupTableAddresses,
    } = instructionsResponse.data;
    
    // Step 3: Get Address Lookup Tables
    const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
    if (addressLookupTableAddresses && addressLookupTableAddresses.length > 0) {
      console.log("Loading address lookup tables...");
      const lookupTables = await Promise.all(
        addressLookupTableAddresses.map(async (address: string) => {
          const lookupTableAccount = await connection.getAddressLookupTable(
            new PublicKey(address)
          );
          return lookupTableAccount.value;
        })
      );
      addressLookupTableAccounts.push(...lookupTables.filter(Boolean) as AddressLookupTableAccount[]);
    }
    
    // Step 4: Deserialize instructions
    const deserializeInstruction = (instruction: any) => {
      return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((key: any) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        data: Buffer.from(instruction.data, "base64"),
      });
    };
    
    // Step 5: Build transaction with all instructions
    const instructions: TransactionInstruction[] = [];
    
    // Add our own compute budget (skip Jupiter's)
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );
    
    // Add setup instructions if any
    if (setupInstructions && setupInstructions.length > 0) {
      console.log(`Adding ${setupInstructions.length} setup instructions...`);
      instructions.push(...setupInstructions.map(deserializeInstruction));
    }
    
    // Add main swap instruction
    console.log("Adding swap instruction...");
    instructions.push(deserializeInstruction(swapInstruction));
    
    // Add cleanup instruction if any
    if (cleanupInstruction) {
      console.log("Adding cleanup instruction...");
      instructions.push(deserializeInstruction(cleanupInstruction));
    }
    
    // Add LightSpeed tip (always last)
    console.log("Adding LightSpeed tip...");
    addLightSpeedTip(instructions, wallet.publicKey);
    
    // Step 6: Build and sign transaction
    console.log("\nBuilding transaction...");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('processed');
    
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(addressLookupTableAccounts);
    
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([wallet]);
    
    // Step 7: Send transaction
    console.log("\nSending swap transaction...");
    const signature = await sendTxWithRetries(transaction);
    
    if (signature) {
      console.log(`\n✅ Swap transaction sent!`);
      console.log(`- Signature: ${signature}`);
      console.log(`- View on Solscan: https://solscan.io/tx/${signature}`);
      console.log(`- Swapped: ${amountIn / LAMPORTS_PER_SOL} SOL → ~${(outAmount / 1000000).toFixed(4)} USDC`);
      console.log(`- Including LightSpeed tip: ${TIPS_VIBE_FEE / LAMPORTS_PER_SOL} SOL`);
      
      // Monitor confirmation
      const result = await monitorTransactionStatus(signature);
      
      if (result && !result.err) {
        console.log(`\n🎉 Swap confirmed successfully!`);
      } else if (result?.err) {
        console.error(`\n❌ Swap failed:`, result.err);
      }
    }
    
  } catch (error: any) {
    console.error("\n❌ Swap error:", error.message);
    
    if (error.response?.data) {
      console.error("API Error:", JSON.stringify(error.response.data, null, 2));
    }
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        console.error("Rate limited. Try again in a few seconds.");
      } else if (error.response?.status === 400) {
        console.error("Bad request. Check your parameters.");
      }
    }
  }
}