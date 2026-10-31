/**
 * The open database handle and the build record, opened once per process.
 *
 * One connection for the whole server. `node:sqlite` is synchronous, so a second
 * handle would buy nothing and would double the memory for no reason.
 */


import { openStore, storePath, buildMeta } from "../store.ts";

export const db = openStore(storePath());
export const meta = buildMeta(db);
