/**
 * CScout Types Module
 * 
 * NOTE: Per mentor guidance, the SQLite database approach has been removed.
 * CScout should be queried directly via REST API, not through database dumps.
 * 
 * This file contains type definitions that may be useful for type safety
 * when working with CScout REST API responses.
 * 
 * See: https://github.com/dspinellis/cscout/issues/82
 */

/** A CScout project */
export interface CScoutProject {
  pid: number;
  name: string;
}

/** A source file tracked by CScout */
export interface CScoutFile {
  fid: number;
  name: string;
  path: string;
  dir: string;
  readonly: boolean;
}

/** An identifier (variable, function, macro, etc.) */
export interface CScoutIdentifier {
  eid: string;
  name: string;
  size: number;
  readonly: boolean;
  unused: boolean;
  xfile: boolean;
  macro: boolean;
  typedef: boolean;
  function: boolean;
  tag: boolean;
  member: boolean;
  cscope: boolean;
  lscope: boolean;
}

/** A function or macro */
export interface CScoutFunction {
  fid: string;
  name: string;
  is_static: boolean;
  is_defined: boolean;
  is_macro: boolean;
  ncallers: number;
  ncallees: number;
  file?: string;
  line?: number;
  file_id?: number;
}

/** A source code location */
export interface TokenLocation {
  fid: number;
  filePath: string;
  line: number;
  column: number;
}

/** File metrics from CScout analysis */
export interface FileMetrics {
  fid: number;
  path: string;
  readonly: boolean;
  metrics: Array<{
    name: string;
    pre_cpp?: number;
    post_cpp?: number;
  }>;
}

/** A function call relationship */
export interface FunctionCall {
  sourceId: string;
  sourceName: string;
  destId: string;
  destName: string;
}
