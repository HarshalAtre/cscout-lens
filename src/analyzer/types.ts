// Core data types shared across the extension

export interface CsSymbol {
    /** Opaque identifier matching CScout's id= query parameter */
    eid: string;
    name: string;
    kind: 'function' | 'macro' | 'typedef' | 'tag' | 'member' | 'variable';
    unused: boolean;
}

export interface CsFile {
    fid: number;
    path: string;
    writable: boolean;
}

export interface CsFunction {
    /** Opaque identifier matching CScout's f= query parameter */
    fid: string;
    name: string;
    isStatic: boolean;
}

export interface CsMetric {
    label: string;
    value: number;
}

export interface CsLocation {
    filePath: string;
    line: number;
    column: number;
}

export interface CsProjectEntry {
    pid: number;
    name: string;
}
