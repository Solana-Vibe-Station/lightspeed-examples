import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  WALLET_PATH,
  TIPS_VIBE_FEE,
  TIPS_VIBE_STATION,
  connection,
  loadWallet,
  USE_LIGHTSPEED
} from './utils';
import { solTransfer, tokenTransfer } from './examples/native';
import { jupiterSwapSOLtoUSDC } from './examples/jupiter';

async function main() {
  try {

    console.log("Solana Vibe Station Priority Transaction Examples");
    console.log("===================================================");
    console.log(`LightSpeed Mode: ${USE_LIGHTSPEED ? 'ENABLED ⚡' : 'DISABLED'}`);
    if (USE_LIGHTSPEED) {
      console.log(`Tip Address: ${TIPS_VIBE_STATION.toString()}`);
      console.log(`Tip Amount: ${TIPS_VIBE_FEE / LAMPORTS_PER_SOL} SOL`);
    }
    console.log("");
    
    // Just load wallet and show balance
    const wallet = loadWallet(WALLET_PATH);
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet: ${wallet.publicKey.toString()}`);
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    console.log("");
    
    // Example 1
    // await solTransfer();

    // Example 2
    // await jupiterSwapSOLtoUSDC();

    // Example 3
    // Default: Send minimum USDC to default recipient
    await tokenTransfer();
    
  } catch (error) {
    console.error("Error in main execution:", error);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}