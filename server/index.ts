#!/usr/bin/env node
/**
 * The entry point. Everything it needs lives in app.ts.
 *
 * Kept as a separate file because `npm run serve` points here, the container
 * runs here, and a reader should be able to start at a ten-line file.
 */

import { start } from "./app.ts";

start();
