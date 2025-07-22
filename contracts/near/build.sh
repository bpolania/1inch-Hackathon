#!/bin/bash
set -e

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Copy the wasm file to out directory
mkdir -p out
cp target/wasm32-unknown-unknown/release/cross_chain_htlc.wasm out/

echo "NEAR contract built successfully!"
echo "Contract WASM: out/cross_chain_htlc.wasm"