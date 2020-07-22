/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
// 创建一个对象作为拦截器 创建了继承自Array原型的空对象arrayMethods
export const arrayMethods = Object.create(arrayProto)

// 改变数组自身内容的7个方法
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 此处的 forEach 是否可以换成 map ？
 */
methodsToPatch.forEach(function (method) {
  // 缓存原生方法
  const original = arrayProto[method]
  // 使用object.defineProperty方法将那些可以改变数组自身的7个方法遍历逐个进行封装
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args // 如果是push或unshift方法，那么传入参数就是新增的元素
        break
      case 'splice':
        // arrayObject.splice(index,howmany,item1,.....,itemX)
        inserted = args.slice(2) // 如果是splice方法，那么传入参数列表中下标为2的就是新增的元素
        break
    }
    if (inserted) ob.observeArray(inserted) // 调用observe函数将新增的元素转化成响应式
    // notify change 通知改变
    ob.dep.notify()
    return result
  })
})
