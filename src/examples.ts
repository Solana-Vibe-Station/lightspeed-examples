import { 
  PublicKey, 
  SystemProgram, 
  TransactionMessage, 
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from "@solana/web3.js";
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  WALLET_PATH,
  TIPS_VIBE_FEE,
  connection,
  loadWallet,
  addComputeBudget,
  addLightSpeedTip,
  sendTxWithRetries,
  checkBalanceForOperations,
  monitorTransactionStatus
} from './utils';

/**
 * Example 1: Simple SOL Transfer with Priority Tip
 */
export async function example1_solTransfer() {
  console.log("\n=== Example 1: SOL Transfer with Priority Tip ===");
  
  const wallet = loadWallet(WALLET_PATH);
  const recipient = new PublicKey('DTFhyarmG9UJn2bnt29GLjcEKfPEFRQC7YCgywuhapAv'); // Replace with actual recipient
  const transferAmount = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
  
  // Calculate total needed
  const txFee = 5000; // ~0.000005 SOL for transaction fee
  const totalNeeded = transferAmount + TIPS_VIBE_FEE + txFee;
  
  // Check balance
  const hasBalance = await checkBalanceForOperations(wallet, totalNeeded, "SOL transfer");
  if (!hasBalance) {
    return;
  }
  
  const instructions: TransactionInstruction[] = [];
  
  // Add compute budget for priority
  addComputeBudget(instructions);
  
  // Main transfer
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient,
      lamports: transferAmount,
    })
  );
  
  // Add priority tip
  addLightSpeedTip(instructions, wallet.publicKey);
  
  // Build and send transaction
  const { blockhash } = await connection.getLatestBlockhash('processed');
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  
  const signature = await sendTxWithRetries(tx);
  console.log(`Transfer complete: ${signature}`);
  
  // Monitor confirmation
  if (signature) {
    await monitorTransactionStatus(signature);
  }
}

/**
 * Example 2: SPL Token Transfer with Priority Tip
 */
export async function example2_tokenTransfer() {
  console.log("\n=== Example 2: SPL Token Transfer with Priority Tip ===");
  
  const wallet = loadWallet(WALLET_PATH);
  const recipient = new PublicKey('RECIPIENT_PUBLIC_KEY'); // Replace with actual recipient
  const tokenMint = new PublicKey('TOKEN_MINT_ADDRESS'); // Replace with actual token mint
  const amount = 1000000; // Adjust based on token decimals
  
  // Calculate total needed
  const txFee = 5000; // ~0.000005 SOL for transaction fee
  const accountCreationRent = 2039280; // ~0.00203928 SOL for creating token account if needed
  
  // Check if recipient token account exists
  const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, recipient);
  const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  const needsAccountCreation = !recipientAccountInfo;
  
  const totalNeeded = TIPS_VIBE_FEE + txFee + (needsAccountCreation ? accountCreationRent : 0);
  
  // Show what we're doing
  console.log(`Token transfer details:`);
  console.log(`- Sending ${amount} tokens`);
  console.log(`- Recipient needs token account: ${needsAccountCreation}`);
  console.log(`- Total SOL needed: ${totalNeeded / LAMPORTS_PER_SOL}`);
  
  // Check balance
  const hasBalance = await checkBalanceForOperations(wallet, totalNeeded, "token transfer");
  if (!hasBalance) {
    return;
  }
  
  const instructions: TransactionInstruction[] = [];
  
  // Add compute budget for priority
  addComputeBudget(instructions);
  
  // Get sender token account
  const senderTokenAccount = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );
  
  // Create recipient token account if needed
  if (needsAccountCreation) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        recipientTokenAccount,
        recipient,
        tokenMint
      )
    );
  }
  
  // Token transfer instruction
  instructions.push(
    createTransferInstruction(
      senderTokenAccount,
      recipientTokenAccount,
      wallet.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  // Add priority tip
  addLightSpeedTip(instructions, wallet.publicKey);
  
  // Build and send transaction
  const { blockhash } = await connection.getLatestBlockhash('processed');
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  
  const signature = await sendTxWithRetries(tx);
  console.log(`Token transfer complete: ${signature}`);
  
  // Monitor confirmation
  if (signature) {
    await monitorTransactionStatus(signature);
  }
}