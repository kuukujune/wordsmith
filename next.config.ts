import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "wordnet-db"],
  outputFileTracingExcludes: {
    "/api/meaning{,/**}": ["./node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/win32/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*cuda*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*tensorrt*"],
  },
  outputFileTracingIncludes: {
    "/api/meaning{,/**}": ["./node_modules/onnxruntime-node/node_modules/onnxruntime-common/**/*", "./node_modules/@img/sharp-linux-x64/**/*", "./node_modules/@img/sharp-libvips-linux-x64/**/*", "./node_modules/sharp/**/*"],
    "/api/meaning": ["./src/data/meaning/*.json", "./src/data/meaning/*.gz", "./node_modules/wordnet-db/dict/*", "./.cache/meaning-models/**/*", "./node_modules/onnxruntime-node/package.json", "./node_modules/onnxruntime-node/dist/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*", "./node_modules/onnxruntime-common/package.json", "./node_modules/onnxruntime-common/dist/**/*"],
    "/api/meaning/health": ["./src/data/meaning/*.json", "./src/data/meaning/*.gz", "./node_modules/wordnet-db/dict/*", "./.cache/meaning-models/**/*", "./node_modules/onnxruntime-node/package.json", "./node_modules/onnxruntime-node/dist/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*", "./node_modules/onnxruntime-common/package.json", "./node_modules/onnxruntime-common/dist/**/*"],
  },
};

export default nextConfig;
