const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Dynamically resolve root: backend/secure_wallet/scripts -> root
const rootDir = path.resolve(__dirname, '../../..');
const backendDir = path.join(rootDir, 'backend');
const buildDir = path.join(backendDir, 'build_bundle');
const targetExe = path.join(rootDir, 'LearnXSK.exe');

console.log('====================================================');
console.log('🛡️  LearnXSK: Building Standalone All-in-One EXE');
console.log('🔒 Secure Wallet Location: backend/secure_wallet');
console.log('📦 Build Bundle Location: backend/build_bundle');
console.log('====================================================');

// 1. Ensure build directory exists in backend
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 2. Embed frontend assets into backend
console.log('📦 Step 1/5: Embedding frontend assets into backend...');
const embedScript = path.join(__dirname, 'embedAssets.js');
execSync(`node "${embedScript}"`, { cwd: rootDir, stdio: 'inherit' });

// 3. Bundle backend with esbuild into a single file in backend/build_bundle
console.log('\n⚡ Step 2/5: Bundling backend server with esbuild...');
const bundleFile = path.join(buildDir, 'bundle.js');
execSync(
  `npx -y esbuild "${path.join(backendDir, 'src/server.ts')}" --bundle --platform=node --target=node20 --outfile="${bundleFile}"`,
  { cwd: rootDir, stdio: 'inherit' }
);

// 4. Create Node SEA configuration
console.log('\n🔧 Step 3/5: Generating Single Executable Application blob...');
const seaBlob = path.join(buildDir, 'sea-prep.blob');
const seaConfig = {
  main: path.relative(rootDir, bundleFile).replace(/\\/g, '/'),
  output: path.relative(rootDir, seaBlob).replace(/\\/g, '/'),
  disableExperimentalSEAWarning: true
};
const seaConfigFile = path.join(buildDir, 'sea-config.json');
fs.writeFileSync(seaConfigFile, JSON.stringify(seaConfig, null, 2), 'utf-8');

execSync(`node --experimental-sea-config "${path.relative(rootDir, seaConfigFile)}"`, {
  cwd: rootDir,
  stdio: 'inherit'
});

// 5. Copy node.exe binary to LearnXSK.exe
console.log('\n📋 Step 4/5: Preparing standalone Windows executable...');
const nodePath = process.execPath;
try {
  if (process.platform === 'win32') {
    execSync('taskkill /F /IM LearnXSK.exe /T 2>nul || exit 0', { shell: 'cmd.exe', stdio: 'ignore' });
  }
} catch {}

if (fs.existsSync(targetExe)) {
  try {
    fs.unlinkSync(targetExe);
  } catch {}
}

console.log(`Copying host Node binary: ${nodePath} -> LearnXSK.exe`);
fs.copyFileSync(nodePath, targetExe);

// 6. Inject SEA blob using postject
console.log('\n💉 Step 5/5: Injecting game & AI runtime into LearnXSK.exe...');
execSync(
  `npx -y postject "${targetExe}" NODE_SEA_BLOB "${seaBlob}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { cwd: rootDir, stdio: 'inherit' }
);

// 7. Verify result
if (fs.existsSync(targetExe)) {
  const stats = fs.statSync(targetExe);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log('\n====================================================');
  console.log(`🎉 SUCCESS! Standalone All-in-One Executable Created!`);
  console.log(`📍 Location: ${targetExe}`);
  console.log(`📊 File Size: ${sizeMB} MB`);
  console.log('🎮 Just double-click LearnXSK.exe to run the game & AI backend!');
  console.log('====================================================\n');
} else {
  console.error('❌ Error: Executable was not created.');
  process.exit(1);
}
