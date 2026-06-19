declare module 'jest-axe' {
  export function axe(
    element: Element | DocumentFragment | string,
    options?: unknown,
  ): Promise<unknown>;

  export const toHaveNoViolations: {
    toHaveNoViolations: (
      this: unknown,
      received: unknown,
    ) => { pass: boolean; message: () => string };
  };
}
