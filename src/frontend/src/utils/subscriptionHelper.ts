/**
 * Helper utilities for safe subscription management
 */

export interface Subscription {
  remove?: () => void;
  _remove?: () => void;
  unsubscribe?: () => void;
  cancel?: () => void;
  off?: () => void;
}

export function safeUnsubscribe(subscription: any, name: string = 'subscription'): void {
  if (!subscription) {
    return;
  }

  try {
    // Try common unsubscribe methods
    if (typeof subscription.remove === 'function') {
      subscription.remove();
      console.log(`✅ ${name} removed via remove()`);
    } else if (typeof subscription._remove === 'function') {
      subscription._remove();
      console.log(`✅ ${name} removed via _remove()`);
    } else if (typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
      console.log(`✅ ${name} removed via unsubscribe()`);
    } else if (typeof subscription.cancel === 'function') {
      subscription.cancel();
      console.log(`✅ ${name} removed via cancel()`);
    } else if (typeof subscription.off === 'function') {
      subscription.off();
      console.log(`✅ ${name} removed via off()`);
    } else if (typeof subscription === 'function') {
      // Some subscriptions are just functions
      subscription();
      console.log(`✅ ${name} removed via function call`);
    } else {
      console.log(`⚠️ ${name} has no known unsubscribe method`);
    }
  } catch (error) {
    console.error(`❌ Error removing ${name}:`, error);
  }
}

export class SubscriptionManager {
  private subscriptions: Map<string, any> = new Map();

  add(name: string, subscription: any): void {
    if (subscription) {
      // Clean up existing subscription with same name
      this.remove(name);
      this.subscriptions.set(name, subscription);
    }
  }

  remove(name: string): void {
    const subscription = this.subscriptions.get(name);
    if (subscription) {
      safeUnsubscribe(subscription, name);
      this.subscriptions.delete(name);
    }
  }

  removeAll(): void {
    this.subscriptions.forEach((subscription, name) => {
      safeUnsubscribe(subscription, name);
    });
    this.subscriptions.clear();
  }

  has(name: string): boolean {
    return this.subscriptions.has(name);
  }

  get(name: string): any {
    return this.subscriptions.get(name);
  }
}