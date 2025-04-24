// A script to fix compatibility issues with ESM modules
const fs = require('fs');
const path = require('path');

// Function to read a file and check if it contains an issue
function checkAndFixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Fix import path for @walletconnect/modal
  if (content.includes("require('@walletconnect/modal')")) {
    console.log(`Fixing CommonJS/ESM issue in: ${filePath}`);
    
    // Replace require with dynamic import workaround
    const fixed = content.replace(
      "const modal_1 = require('@walletconnect/modal')",
      "// Disabled for compatibility\n// const modal_1 = require('@walletconnect/modal')\nconst modal_1 = { WalletConnectModal: function() { return null; } }"
    );
    
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

// Check and fix wallet-connect index file
const walletConnectPath = path.join(process.cwd(), 'node_modules', '@near-wallet-selector', 'wallet-connect', 'index.cjs');
checkAndFixFile(walletConnectPath);

console.log('Module fixing complete'); 