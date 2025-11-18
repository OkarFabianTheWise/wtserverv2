declare module "node-gtts" {
  interface GttsInstance {
    save(
      filepath: string,
      text: string,
      cb?: (err: Error | null) => void
    ): void;
  }

  function gtts(lang?: string): GttsInstance;

  export default gtts;
}
