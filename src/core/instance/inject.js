/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  // 首先调用resolveInject把inject选项中的数据转化成键值对的形式赋给result
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 先调用toggleObserving(false)，而这个函数内部是把shouldObserve = false，
    // 这是为了告诉defineReactive函数仅仅是把键值添加到当前实例上而不需要将其转换成响应式，
    // 这个就呼应了官方文档在介绍provide 和 inject 选项用法的时候所提示的:
    // provide 和 inject 绑定并不是可响应的。这是刻意为之的。
    // 然而，如果你传入了一个可监听的对象，那么其对象的属性还是可响应的.
    toggleObserving(false)
    // 然后遍历result中的每一对键值，调用defineReactive函数将其添加当前实例上
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // 首先创建一个空对象result，用来存储inject 选项中的数据key及其对应的值，作为最后的返回结果
    const result = Object.create(null)
    // 然后获取当前inject 选项中的所有key
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    // 然后遍历每一个key
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      // 拿到每一个key的from属性记作provideKey,provideKey就是上游父级组件提供的源属性
      const provideKey = inject[key].from
      let source = vm
      // 然后开启一个while循环
      while (source) {
        // 从当前组件起，不断的向上游父级组件的_provided属性中（父级组件使用provide选项注入数据时会将注入的数据存入自己的实例的_provided属性中）查找，
        // 直到查找到源属性的对应的值，将其存入result中
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }


      // 如果没有找到
      if (!source) {
        // 那么就看inject 选项中当前的数据key是否设置了默认值，即是否有default属性，
        if ('default' in inject[key]) {
          // 如果有的话，则拿到这个默认值，
          // 官方文档示例中说了，默认值可以为一个工厂函数，
          // 所以当默认值是函数的时候，就去该函数的返回值，否则就取默认值本身。
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 如果没有设置默认值，则抛出异常。
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    // 最后将result返回。这就是resolveInject函数的所有逻辑
    return result
  }
}
