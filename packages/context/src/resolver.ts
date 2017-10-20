// Copyright IBM Corp. 2013,2017. All Rights Reserved.
// Node module: loopback
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Context} from './context';
import {Binding, BoundValue, ValueOrPromise} from './binding';
import {isPromise} from './is-promise';
import {
  describeInjectedArguments,
  describeInjectedProperties,
  Injection,
} from './inject';

/**
 * A class constructor accepting arbitrary arguments.
 */
export type Constructor<T> =
  // tslint:disable-next-line:no-any
  new (...args: any[]) => T;

/**
 * Create an instance of a class which constructor has arguments
 * decorated with `@inject`.
 *
 * The function returns a class when all dependencies were
 * resolved synchronously, or a Promise otherwise.
 *
 * @param ctor The class constructor to call.
 * @param ctx The context containing values for `@inject` resolution
 * @param binding The optional binding of the class if bound
 */
export function instantiateClass<T>(
  ctor: Constructor<T>,
  ctx: Context,
  binding?: Binding,
): T | Promise<T> {
  const argsOrPromise = resolveInjectedArguments(ctor, ctx, binding);
  const propertiesOrPromise = resolveInjectedProperties(ctor, ctx, binding);
  let inst: T | Promise<T>;
  if (isPromise(argsOrPromise)) {
    // Instantiate the class asynchronously
    inst = argsOrPromise.then(args => new ctor(...args));
  } else {
    // Instantiate the class synchronously
    inst = new ctor(...argsOrPromise);
  }
  if (isPromise(propertiesOrPromise)) {
    return propertiesOrPromise.then(props => {
      if (isPromise(inst)) {
        // Inject the properties asynchronously
        return inst.then(obj => Object.assign(obj, props));
      } else {
        // Inject the properties synchronously
        return Object.assign(inst, props);
      }
    });
  } else {
    if (isPromise(inst)) {
      // Inject the properties asynchronously
      return inst.then(obj => Object.assign(obj, propertiesOrPromise));
    } else {
      // Inject the properties synchronously
      return Object.assign(inst, propertiesOrPromise);
    }
  }
}

/**
 * Resolve the value or promise for a given injection
 * @param ctx Context
 * @param injection Descriptor of the injection
 */
function resolve<T>(ctx: Context, injection: Injection): ValueOrPromise<T> {
  if (injection.resolve) {
    // A custom resolve function is provided
    return injection.resolve(ctx, injection);
  }
  // Default to resolve the value from the context by binding key
  return ctx.getValueOrPromise(injection.bindingKey);
}

/**
 * Given a function with arguments decorated with `@inject`,
 * return the list of arguments resolved using the values
 * bound in `ctx`.

 * The function returns an argument array when all dependencies were
 * resolved synchronously, or a Promise otherwise.
 *
 * @param fn The function for which the arguments should be resolved.
 * @param ctx The context containing values for `@inject` resolution
 * @param binding The optional binding of the class if bound
 */
export function resolveInjectedArguments(
  fn: Function,
  ctx: Context,
  binding?: Binding,
): BoundValue[] | Promise<BoundValue[]> {
  // NOTE: the array may be sparse, i.e.
  //   Object.keys(injectedArgs).length !== injectedArgs.length
  // Example value:
  //   [ , 'key1', , 'key2']
  const injectedArgs = describeInjectedArguments(fn);

  const args: BoundValue[] = new Array(fn.length);
  let asyncResolvers: Promise<void>[] | undefined = undefined;

  for (let ix = 0; ix < fn.length; ix++) {
    let injection = injectedArgs[ix];
    if (!injection.bindingKey && !injection.resolve) {
      throw new Error(
        `Cannot resolve injected arguments for function ${fn.name}: ` +
          `The argument ${ix + 1} was not decorated for dependency injection.`,
      );
    }
    // Copy the injection so that we can set the parent binding
    injection = Object.assign({binding}, injection);

    const valueOrPromise = resolve(ctx, injection);
    if (isPromise(valueOrPromise)) {
      if (!asyncResolvers) asyncResolvers = [];
      asyncResolvers.push(
        valueOrPromise.then((v: BoundValue) => (args[ix] = v)),
      );
    } else {
      args[ix] = valueOrPromise as BoundValue;
    }
  }

  if (asyncResolvers) {
    return Promise.all(asyncResolvers).then(() => args);
  } else {
    return args;
  }
}

export type KV = {[p: string]: BoundValue};

/**
 * Given a class with properties decorated with `@inject`,
 * return the map of properties resolved using the values
 * bound in `ctx`.

 * The function returns an argument array when all dependencies were
 * resolved synchronously, or a Promise otherwise.
 *
 * @param fn The function for which the arguments should be resolved.
 * @param ctx The context containing values for `@inject` resolution
 * @param binding The optional binding of the class if bound
 */
export function resolveInjectedProperties(
  fn: Function,
  ctx: Context,
  binding?: Binding,
): KV | Promise<KV> {
  const injectedProperties = describeInjectedProperties(fn.prototype);

  const properties: KV = {};
  let asyncResolvers: Promise<void>[] | undefined = undefined;

  const propertyResolver = (p: string) => (v: BoundValue) =>
    (properties[p] = v);

  for (const p in injectedProperties) {
    let injection = injectedProperties[p];
    if (!injection.bindingKey && !injection.resolve) {
      throw new Error(
        `Cannot resolve injected property for class ${fn.name}: ` +
          `The property ${p} was not decorated for dependency injection.`,
      );
    }
    // Copy the injection so that we can set the parent binding
    injection = Object.assign({binding}, injection);
    const valueOrPromise = resolve(ctx, injection);
    if (isPromise(valueOrPromise)) {
      if (!asyncResolvers) asyncResolvers = [];
      asyncResolvers.push(valueOrPromise.then(propertyResolver(p)));
    } else {
      properties[p] = valueOrPromise as BoundValue;
    }
  }

  if (asyncResolvers) {
    return Promise.all(asyncResolvers).then(() => properties);
  } else {
    return properties;
  }
}
