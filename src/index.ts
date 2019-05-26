#!/usr/bin/env node
import program from 'commander';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import path from 'path';
import { startServer } from './server';
import { gradientLog, log, errorLog, successLog } from './log';
import { 
  webpackConfig, webpackCompile, webpackConfigTypeScript 
} 
from './webpack-compiler';

export const memFS = new MemoryFS();

gradientLog('⚡️ Starting react-serve!\n');

let global_ServingDir;

program
  .version('0.0.2')
  .arguments('<servingDir>')
  .option('-p, --port [number]', 'Specify port')
  .option('-e, --entry [entry]', 'Entry point for webpack')
  .option('-t, --typescript', 'Comspile for TypeScript')
  .action(async servingDir => {
    /**
     * This action callback is not triggered unless the user provides their 
     * serving directory. This means checking for it's existence here won't work
     * for informing them of their error. If no serving directory is provided it will
     * skip over this action and go straight to the check for the serving dir. The
     * global variable will be undefined and log the error message.
     * 
     * However, this action callback fires synchronously, so if they provide a serbing
     * directory we need to do a check to not erroneously log the message.
     */
    global_ServingDir = servingDir;

    const port = program.port || 8001;
    const ts = !!program.typescript;
    const absoluteEntryPath = getAbsoluteEntryPath({ servingDir, program });
    
    if(ts) {
      log('> Using a TypeScript webpack config');
    }

    log('> Looking for a webpack entry point...');

    const config = ts ? 
      webpackConfigTypeScript({ dir: servingDir, absoluteEntryPath }) : 
      webpackConfig({ dir: servingDir, absoluteEntryPath });

    successLog(`> > Using ${absoluteEntryPath}\n`);
    log(`> > Staring webpack!\n`);
    
    const compiler = webpack(config);
    compiler.outputFileSystem = memFS;
    const stats = await webpackCompile(compiler);

    log(`${stats.toString()}\n`);

    if(webpackBuildHasErrors(stats)) { return; }

    successLog(`> > Build successful! \n`);
    log(`> Starting server! \n`);

    gradientLog(`------------------------------------------------------------------\n`);

    log(`The webpack bundle (/bundle.js) is served from an in memory filesystem. \n`);
    log(`Static files are served from ${process.cwd()}/${servingDir}\n`);
    
    gradientLog('------------------------------------------------------------------\n');

    startServer({ publicDir: servingDir, port });
  })
  .parse(process.argv);

  if(global_ServingDir == undefined) {
    const message = `No serving directory specified!

serve-react needs know two things:

1) Serving directory. This is where your static assets are (index.html, styles.css, etc...).
   ex: serve-react static

2) Entry file for webpack. serve-react will look for an index.{js,tsx} file in the serving directory if no file is provided.
    ex: serve-react static -e src/index.js
`;
    errorLog(message);
    process.exit(0);
  }

function getAbsoluteEntryPath({ program, servingDir }: { program: any, servingDir: string }) {
  return typeof program.entry === 'string' ? 
    path.join(process.cwd(), program.entry) : 
    path.join(process.cwd(), servingDir, `index.${determineExtension(program)}`);
}

function determineExtension(program: any) {
  return typeof program.typescript === 'boolean' ? 'tsx' : 'js';
}

function webpackBuildHasErrors(stats: webpack.Stats) {
  // For some reason stats.hasErrors() can return true when there are no errors?
  return stats.compilation.errors.length > 0
}
