declare module '@testforge/db' {
  export function createClient(connectionString?: string): unknown;
}

declare module 'better-sqlite3' {
  namespace BetterSqlite3 {
    interface Database {
      exec(sql: string): this;
      prepare(sql: string): Statement;
      pragma(pragma: string, options?: { simple?: boolean }): unknown;
      close(): void;
    }
    interface Statement {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }
  }
  function BetterSqlite3(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number; verbose?: (sql: string, ...params: unknown[]) => void }): BetterSqlite3.Database;
  export = BetterSqlite3;
}
