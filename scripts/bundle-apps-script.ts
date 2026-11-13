import fs from 'fs';
import path from 'path';

const srcDir = path.resolve(process.cwd(), 'google-apps-script', 'src');
const testDir = path.resolve(process.cwd(), 'google-apps-script', 'tests');
const rootOutput = path.resolve(process.cwd(), 'Code.gs');
const gasOutput = path.resolve(process.cwd(), 'google-apps-script', 'Code.gs');

const fileOrder = [
  'config.gs',
  'responseUtils.gs',
  'security.gs',
  'validationService.gs',
  'spreadsheetService.gs',
  'transactionService.gs',
  'settlementService.gs',
  'freelanceService.gs',
  'Code.gs'
];

let bundleContent = `/**
 * MSR Penny — Google Apps Script Web App (Production Bundle)
 * Automatically concatenated from modular source files in google-apps-script/src/
 * Version: 3.1.0
 */\n\n`;

for (const file of fileOrder) {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    bundleContent += `// ==============================================================================\n`;
    bundleContent += `// MODULE: ${file}\n`;
    bundleContent += `// ==============================================================================\n\n`;
    bundleContent += fs.readFileSync(filePath, 'utf-8') + '\n\n';
  }
}

// Append test utilities at the bottom
const testFile = path.join(testDir, 'testData.gs');
if (fs.existsSync(testFile)) {
  bundleContent += `// ==============================================================================\n`;
  bundleContent += `// MODULE: testData.gs\n`;
  bundleContent += `// ==============================================================================\n\n`;
  bundleContent += fs.readFileSync(testFile, 'utf-8') + '\n\n';
}

fs.writeFileSync(rootOutput, bundleContent, 'utf-8');
fs.writeFileSync(gasOutput, bundleContent, 'utf-8');

console.log('✅ Google Apps Script successfully bundled into Code.gs and google-apps-script/Code.gs');
