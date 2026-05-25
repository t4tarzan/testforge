declare module '@testforge/db' {
  export function createClient(connectionString?: string): any;
}

declare module 'better-sqlite3' {
  namespace BetterSqlite3 {
    interface Database {
      exec(sql: string): this;
      prepare(sql: string): Statement;
      pragma(pragma: string, options?: { simple?: boolean }): any;
      close(): void;
    }
    interface Statement {
      run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
      get(...params: any[]): any;
      all(...params: any[]): any[];
    }
  }
  function BetterSqlite3(filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number; verbose?: Function }): BetterSqlite3.Database;
  export = BetterSqlite3;
}
