/**
 * Safe import utility for modules that might fail to load
 */

export function safeImport<T>(
  importFn: () => T | Promise<T>,
  fallback: T | null = null,
  moduleName: string = 'module'
): T | null {
  try {
    const result = importFn();
    if (result instanceof Promise) {
      result.catch(error => {
        console.error(`Failed to import ${moduleName}:`, error);
      });
    }
    return result as T;
  } catch (error) {
    console.error(`Failed to import ${moduleName}:`, error);
    return fallback;
  }
}

export async function safeAsyncImport<T>(
  importFn: () => Promise<T>,
  fallback: T | null = null,
  moduleName: string = 'module'
): Promise<T | null> {
  try {
    return await importFn();
  } catch (error) {
    console.error(`Failed to async import ${moduleName}:`, error);
    return fallback;
  }
}

export function safeRequire<T>(
  modulePath: string,
  fallback: T | null = null
): T | null {
  try {
    return require(modulePath);
  } catch (error) {
    console.error(`Failed to require ${modulePath}:`, error);
    return fallback;
  }
}