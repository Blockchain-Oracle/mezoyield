import "@testing-library/jest-dom/vitest";

// jsdom uses an opaque origin by default, which makes localStorage / sessionStorage
// throw on access. RainbowKit reads `localStorage` synchronously at provider mount.
// Polyfill an in-memory store so the test environment is usable.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(window, "localStorage", {
  value: new MemoryStorage(),
  writable: false,
});
Object.defineProperty(window, "sessionStorage", {
  value: new MemoryStorage(),
  writable: false,
});

// matchMedia is consumed by RainbowKit / framer-motion and not implemented by jsdom.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
