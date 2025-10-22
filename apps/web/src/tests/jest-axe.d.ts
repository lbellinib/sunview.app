declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}
export {};
