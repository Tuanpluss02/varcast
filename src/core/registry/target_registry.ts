import type { Target } from '../target';

export class TargetRegistry {
  private readonly targets = new Map<string, Target<any, any>>();

  /**
   * Registers a target into this registry instance.
   * Throws an error if a target with the same ID is already registered.
   */
  register(target: Target<any, any>): void {
    if (this.targets.has(target.id)) {
      throw new Error(`Target with ID "${target.id}" is already registered.`);
    }
    this.targets.set(target.id, target);
  }

  /**
   * Retrieves a registered target by its unique ID.
   * Throws an error if the target ID is not registered.
   */
  get(id: string): Target<any, any> {
    const target = this.targets.get(id);
    if (!target) {
      throw new Error(`Target with ID "${id}" is not registered.`);
    }
    return target;
  }

  /**
   * Checks whether a target ID has been registered.
   */
  has(id: string): boolean {
    return this.targets.has(id);
  }

  /**
   * Returns all registered targets in their insertion (registration) order.
   */
  getAll(): Target<any, any>[] {
    return Array.from(this.targets.values());
  }

  /**
   * Clears all registered targets from this registry instance.
   */
  clear(): void {
    this.targets.clear();
  }
}

/**
 * Global singleton TargetRegistry instance.
 */
const defaultRegistry = new TargetRegistry();

/**
 * Registers a target into the global target registry.
 * Throws if a target with the same ID is already registered.
 */
export function registerTarget(target: Target<any, any>): void {
  defaultRegistry.register(target);
}

/**
 * Retrieves a registered target by its ID from the global target registry.
 * Throws if not found.
 */
export function getTarget(id: string): Target<any, any> {
  return defaultRegistry.get(id);
}

/**
 * Checks whether a target ID exists in the global target registry.
 */
export function hasTarget(id: string): boolean {
  return defaultRegistry.has(id);
}

/**
 * Returns all registered targets in registration order from the global target registry.
 */
export function getAllTargets(): Target<any, any>[] {
  return defaultRegistry.getAll();
}

/**
 * Clears the global target registry. Useful for unit tests.
 */
export function clearRegistry(): void {
  defaultRegistry.clear();
}
