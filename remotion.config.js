const { Config } = require('@remotion/cli/config');

Config.setEntryPoint('demo/ad/src/index.ts');
Config.setPublicDir('demo/ad/public');
Config.setVideoImageFormat('jpeg');
Config.setStillImageFormat('png');
Config.setOverwriteOutput(true);
