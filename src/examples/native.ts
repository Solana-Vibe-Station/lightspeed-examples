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
  DEFAULT_RECIPIENT,
  connection,
  loadWallet,
  addComputeBudget,
  addLightSpeedTip,
  sendTxWithRetries,
  checkBalanceForOperations,
  monitorTransactionStatus
} from '../utils';

/**
 * Example: Simple SOL Transfer with Priority Tip
 */
export async function solTransfer(recipientAddress?: string) {
  console.log("\n=== SOL Transfer with LightSpeed Tip ===");
  
  const wallet = loadWallet(WALLET_PATH);
  const recipient = recipientAddress 
    ? new PublicKey(recipientAddress)
    : new PublicKey(DEFAULT_RECIPIENT);  // Use env variable
  const transferAmount = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
  
  // Calculate total needed
  const txFee = 5000; // ~0.000005 SOL for transaction fee
  const totalNeeded = transferAmount + txFee;  // Don't add TIPS_VIBE_FEE here
  
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
 * Example: SPL Token Transfer with Priority Tip
 * Defaults to USDC with minimum amount (0.000001 USDC)
 */
export async function tokenTransfer(
  recipientAddress?: string,
  tokenMintAddress?: string,
  amount?: number
) {
  console.log("\n=== SPL Token Transfer with LightSpeed Tip ===");
  
  const wallet = loadWallet(WALLET_PATH);
  
  // Default values
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const USDC_DECIMALS = 6;
  
  // Use provided values or defaults
  const recipient = recipientAddress 
    ? new PublicKey(recipientAddress) 
    : new PublicKey(DEFAULT_RECIPIENT); // Default recipient
  
  const tokenMint = tokenMintAddress 
    ? new PublicKey(tokenMintAddress)
    : new PublicKey(USDC_MINT);
  
  // Default to minimum amount (1 unit = 0.000001 USDC for 6 decimals)
  const transferAmount = amount ?? 1;
  
  // Determine token info
  const isUSDC = tokenMint.toString() === USDC_MINT;
  const tokenName = isUSDC ? 'USDC' : 'tokens';
  const displayAmount = isUSDC 
    ? (transferAmount / Math.pow(10, USDC_DECIMALS)).toFixed(6)
    : transferAmount.toString();
  
  console.log(`Token transfer details:`);
  console.log(`- Token: ${tokenName} (${tokenMint.toString().slice(0, 8)}...)`);
  console.log(`- Recipient: ${recipient.toString()}`);
  console.log(`- Amount: ${displayAmount} ${tokenName}`);
  
  // Calculate total needed (only SOL for fees)
  const txFee = 5000; // ~0.000005 SOL for transaction fee
  const accountCreationRent = 2039280; // ~0.00203928 SOL for creating token account if needed
  
  // Check if recipient token account exists
  const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, recipient);
  const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
  const needsAccountCreation = !recipientAccountInfo;
  
  const totalSOLNeeded = txFee + (needsAccountCreation ? accountCreationRent : 0);
  
  console.log(`- Recipient needs token account: ${needsAccountCreation}`);
  console.log(`- Total SOL needed for fees: ${totalSOLNeeded / LAMPORTS_PER_SOL}`);
  
  // Check balance (only need SOL for fees)
  const hasBalance = await checkBalanceForOperations(wallet, totalSOLNeeded, "token transfer");
  if (!hasBalance) {
    return;
  }
  
  // Check token balance
  const senderTokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
  const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
  
  if (!senderTokenAccountInfo) {
    console.error(`\n❌ Error: You don't have a token account for this mint`);
    console.error(`Token mint: ${tokenMint.toString()}`);
    return;
  }
  
  // Parse token balance
  const tokenAccountData = await connection.getParsedAccountInfo(senderTokenAccount);
  const tokenBalance = (tokenAccountData.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount || 0;
  
  console.log(`- Your ${tokenName} balance: ${tokenBalance}`);
  
  if (tokenBalance < parseFloat(displayAmount)) {
    console.error(`\n❌ Error: Insufficient ${tokenName} balance`);
    console.error(`Have: ${tokenBalance} ${tokenName}`);
    console.error(`Need: ${displayAmount} ${tokenName}`);
    return;
  }
  
  const instructions: TransactionInstruction[] = [];
  
  // Add compute budget for priority
  addComputeBudget(instructions);
  
  // Create recipient token account if needed
  if (needsAccountCreation) {
    console.log("\n📝 Creating recipient token account...");
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
      transferAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  
  // Add LightSpeed tip (if enabled)
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
  
  if (signature) {
    console.log(`\n✅ Token transfer complete!`);
    console.log(`- Signature: ${signature}`);
    console.log(`- Sent: ${displayAmount} ${tokenName}`);
    console.log(`- To: ${recipient.toString()}`);
    console.log(`- View on Solscan: https://solscan.io/tx/${signature}`);
    
    await monitorTransactionStatus(signature);
  }
}