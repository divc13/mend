const { Config } = require('@remotion/cli/config');

Config.setEntryPoint('src/index.ts');
Config.setPublicDir('public');
Config.setVideoImageFormat('jpeg');
Config.setStillImageFormat('png');
Config.setOverwriteOutput(true);
