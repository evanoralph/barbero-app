declare module "simpleddp" {
  type DdpListener = { stop(): void };

  export default class SimpleDDP {
    constructor(opts: Record<string, unknown>, plugins?: unknown[]);
    connected: boolean;
    userId?: string;
    token?: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    call(method: string, ...args: unknown[]): Promise<unknown>;
    on(event: string, f: (...args: unknown[]) => void): DdpListener;
    login(auth: {
      password?: string;
      user?: { email?: string; username?: string };
      resume?: string;
    }): Promise<{ id: string; token: string }>;
    logout(): Promise<void>;
    subscribe(name: string, ...args: unknown[]): {
      stop(): void;
      ready(): Promise<void>;
    };
    collection(name: string): {
      filter(fn: (doc: any) => boolean): {
        fetch(): unknown[];
        onChange(cb: () => void): { stop(): void };
      };
    };
  }
}

declare module "simpleddp-plugin-login" {
  export const simpleDDPLogin: {
    init(this: import("simpleddp").default): void;
  };
}
